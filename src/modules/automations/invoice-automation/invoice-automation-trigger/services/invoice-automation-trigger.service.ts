import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { IScheduleTimeDelay } from '../interfaces/invoice-automation-trigger.interface';
import { UpdateInvoiceAutomationTriggerDto } from '../dto/update-invoice-automation-trigger.dto';
import { InvoiceAutomationTriggerRepository } from '../repository/invoice-automation-trigger.repository';
import { InvoiceAutomationRule } from '@prisma/client';

@Injectable()
export class InvoiceAutomationTriggerService {
  private readonly logger: LoggerService = new Logger();
  private readonly RULE_CACHE_KEY = 'invoice_automation_rule:';
  private readonly RULES_LIST_KEY = 'invoice_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @InjectQueue('invoice-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly globalRepository: GlobalRepository,
    private readonly invoiceAutomationTriggerRepository: InvoiceAutomationTriggerRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async scheduleTimeDelay({
    ruleId,
    columnId,
    companyId,
    invoiceId,
    delayInSeconds,
    type,
  }: IScheduleTimeDelay): Promise<{ jobId: string } | undefined> {
    try {
      // Get the invoice with column change time
      const invoice = await this.globalRepository.findInvoiceById(
        invoiceId,
        companyId,
        type,
      );

      if (!invoice) {
        this.logger.warn('Invoice/Estimate not found!');
        return;
      }

      const baseTime = invoice.columnChangedAt || new Date();

      // Calculate delay from the base time
      const executeAt = new Date(baseTime.getTime() + delayInSeconds * 1000);

      const remainingDelay = executeAt.getTime() - Date.now();

      const actualDelayMs = Math.max(0, remainingDelay);

      // Create a record in the database
      const timeDelayExecution =
        await this.globalRepository.createTimeDelayExecution({
          invoiceAutomationRuleId: ruleId,
          columnId,
          executeAt,
        });
      // Add job to Redis queue with calculated delay
      const job = await this.timeDelayQueue.add(
        'process-invoice-time-delay',
        {
          executionId: timeDelayExecution.id,
          ruleId,
          invoiceId,
          companyId,
        },
        {
          delay: actualDelayMs, // Use actual calculated delay
          jobId: `${timeDelayExecution.id}`,
          removeOnComplete: true,
        },
      );

      // Update the record with the job ID
      await this.globalRepository.updateTimeDelayExecution(
        timeDelayExecution.id,
        job.id.toString(),
      );

      this.logger.log(
        `Scheduled time delay job ${job.id} for ${type.toLocaleLowerCase()} in column ${columnId} with delay ${delayInSeconds} seconds`,
      );

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(`Failed to schedule time delay: ${error.message}`);
      throw error;
    }
  }

  // This method is used to update the invoice automation trigger
  async update(body: UpdateInvoiceAutomationTriggerDto) {
    const { companyId, invoiceId, columnId, type } = body || {};
    this.logger.log(
      `Invoice automation triggered for ${type.toLocaleLowerCase()} ID ${invoiceId}!`,
    );

    //Use cache for rules list
    const rulesCacheKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(rulesCacheKey);

    let invoiceAutomationRules: any[] | null = null;
    if (cachedRules) {
      invoiceAutomationRules = JSON.parse(cachedRules);
      this.logger.log(
        `Loaded invoice automation rules from cache: ${rulesCacheKey}`,
      );
    } else {
      invoiceAutomationRules =
        await this.invoiceAutomationTriggerRepository.findAllRule(companyId);

      await this.cacheManager.set(
        rulesCacheKey,
        JSON.stringify(invoiceAutomationRules),
        this.CACHE_TTL * 1000,
      );

      this.logger.log(
        `Cache set for invoice automation rules trigger: ${rulesCacheKey}`,
      );
    }

    if (!invoiceAutomationRules || invoiceAutomationRules.length === 0) {
      this.logger.warn(
        'No applicable active invoice automation rule found for this company',
      );
      return;
    }

    const applicableRule = invoiceAutomationRules.find(
      (rule: InvoiceAutomationRule) =>
        rule?.invoiceStatusId == columnId &&
        rule.companyId == companyId &&
        rule.type === type,
    );

    if (!applicableRule) {
      this.logger.warn(
        `No applicable active invoice automation rule found for this ${type.toLocaleLowerCase()}!`,
      );
      return;
    }

    if (applicableRule.isPaused) {
      this.logger.warn('The rule is paused!');
      return;
    }

    this.logger.log(
      `Scheduling time delay for ${type.toLocaleLowerCase()} ${invoiceId} with delay ${applicableRule.timeDelay} seconds`,
    );

    await this.scheduleTimeDelay({
      ruleId: applicableRule.id,
      columnId,
      companyId,
      invoiceId: invoiceId,
      type,
      delayInSeconds:
        applicableRule.timeDelay === 'Instant'
          ? 0
          : Number(applicableRule.timeDelay),
    });
    return {
      statusCode: 200,
      message: 'Time delay scheduled successfully',
    };
  }
}
