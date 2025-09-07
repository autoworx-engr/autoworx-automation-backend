import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { DateUtils } from 'src/shared/global-service/utils/date.utils';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ServiceAutomationTriggerRepository } from '../repository/service-automation-trigger.repository';
import { UpdateServiceAutomationTriggerDto } from '../dto/update-service-automation-trigger.dto';
import { IScheduleTimeDelay } from '../interfaces/service-automation-trigger.interface';

@Injectable()
export class ServiceAutomationTriggerService {
  private readonly logger: LoggerService = new Logger();

  private readonly RULE_CACHE_KEY = 'service_automation_rule:';
  private readonly RULES_LIST_KEY = 'service_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 1 hour in seconds
  constructor(
    @InjectQueue('service-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly globalRepository: GlobalRepository,
    private readonly serviceAutomationTriggerRepository: ServiceAutomationTriggerRepository,
    private readonly dateUtils: DateUtils,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // schedules a time delay for a invoice
  async scheduleTimeDelay({
    ruleId,
    estimateId,
    columnId,
    companyId,
    delayInSeconds,
  }: IScheduleTimeDelay): Promise<{ jobId: string }> {
    try {
      // Get the invoice with column change time
      const invoice = await this.globalRepository.findEstimateById(
        estimateId,
        companyId,
      );

      if (!invoice) {
        throw new NotFoundException('The invoice not found');
      }

      // Base time from which to calculate the delay
      // Default to current time if columnChangedAt is null
      const baseTime = invoice.columnChangedAt || new Date();

      // Calculate delay from the base time
      const executeAt = new Date(baseTime.getTime() + delayInSeconds * 1000);

      // Create a record in the database
      const timeDelayExecution =
        await this.globalRepository.createTimeDelayExecution({
          serviceMaintenanceRuleId: ruleId,
          estimateId,
          columnId,
          executeAt,
        });
      // Add job to Redis queue with calculated delay
      const job = await this.timeDelayQueue.add(
        'process-service-time-delay',
        {
          executionId: timeDelayExecution.id,
          ruleId,
          estimateId,
          columnId,
          companyId,
        },
        {
          delay: delayInSeconds * 1000, // Use actual calculated delay
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
        `Scheduled time delay job ${job.id} for invoice ${estimateId} in column ${columnId} with delay ${delayInSeconds} seconds`,
      );

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(`Failed to schedule time delay: ${error.message}`);
      throw error;
    }
  }

  // This method is used to update the service automation trigger
  async update(body: UpdateServiceAutomationTriggerDto) {
    const { companyId, estimateId, columnId } = body || {};
    this.logger.log(
      `Service maintenance automation triggered for invoice ID ${estimateId}!`,
    );

    const rulesCacheKey = `${this.RULES_LIST_KEY}${companyId}`;

    let serviceAutomationRules: any[] | null = null;
    const cachedRules = await this.cacheManager.get<string>(rulesCacheKey);
    if (cachedRules) {
      serviceAutomationRules = JSON.parse(cachedRules);
      this.logger.log(
        `Loaded service automation rules from cache: ${rulesCacheKey}`,
      );
    } else {
      serviceAutomationRules =
        await this.serviceAutomationTriggerRepository.findAllRule(companyId);
      await this.cacheManager.set(
        rulesCacheKey,
        JSON.stringify(serviceAutomationRules),
        this.CACHE_TTL * 1000,
      );
    }

    const invoice = await this.globalRepository.findEstimateById(
      estimateId,
      companyId,
    );

    // Ensure invoice and its items exist

    if (invoice && !invoice.invoiceItems) {
      this.logger.warn('The invoice items not found');
      return;
    }

    if (invoice.type == 'Estimate') {
      return;
    }

    if (!serviceAutomationRules || serviceAutomationRules.length === 0) {
      this.logger.warn(
        'No applicable active service maintenance automation rule found for this company',
      );
      return;
    }

    // Get all serviceIds from invoice items
    try {
      const invoiceServiceIds = invoice.invoiceItems.map((item) =>
        item.service?.name?.trim().toLocaleLowerCase(),
      );

      // First, filter applicable rules by service match
      const matchingRules = serviceAutomationRules.filter((rule) =>
        rule?.serviceMaintenanceStage?.some((stage) =>
          invoiceServiceIds.includes(stage.service?.name?.trim().toLowerCase()),
        ),
      );

      if (!matchingRules.length) {
        this.logger.warn(
          'No applicable active service maintenance automation rule found for this invoice',
        );
        return;
      }

      // Then, from the filtered rules, find one with matching conditionColumnId
      const applicableRule = matchingRules.find(
        (rule) => rule?.conditionColumnId === columnId,
      );

      if (!applicableRule) {
        this.logger.warn(
          'No applicable active service maintenance automation rule found for this invoice',
        );

        return;
      }

      if (applicableRule.isPaused) {
        this.logger.warn('The service maintenance rule is paused');
        return;
      }

      this.logger.log(
        `The service maintenance scheduling time delay for invoice ${estimateId} with delay ${applicableRule.timeDelay} seconds`,
      );

      await this.scheduleTimeDelay({
        ruleId: applicableRule.id,
        estimateId,
        columnId,
        companyId,
        delayInSeconds: applicableRule.timeDelay,
      });
      return {
        statusCode: 200,
        message: 'Time delay scheduled successfully',
      };
    } catch (error) {
      console.log(error);
    } // This will now always run
  }
}
