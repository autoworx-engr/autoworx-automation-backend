import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { InvoiceAutomationRule } from '@prisma/client';
import { TagAutomationTriggerRepository } from '../repository/tag-automation-trigger.repository';
import { IScheduleTimeDelay } from 'src/modules/automations/communication-automation/communication-automation-trigger/interfaces/communication-automation-trigger.interface';
import { UpdateTagAutomationTriggerDto } from '../dto/update-tag-automation-trigger.dto';

@Injectable()
export class TagAutomationTriggerService {
  private readonly logger: LoggerService = new Logger();
  private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
  private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @InjectQueue('tag-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly globalRepository: GlobalRepository,
    private readonly tagAutomationTriggerRepository: TagAutomationTriggerRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async scheduleTimeDelay({
    ruleId,
    columnId,
    companyId,
    delayInSeconds,
    leadId,
  }: IScheduleTimeDelay): Promise<{ jobId: string } | undefined> {
    try {
      // Get the tag with column change time
      const lead = await this.globalRepository.findVehicleById(leadId);

      if (!lead) {
        this.logger.warn('The lead not found!');
        return;
      }

      const baseTime = new Date();

      // Calculate delay from the base time
      const executeAt = new Date(baseTime.getTime() + delayInSeconds * 1000);

      const remainingDelay = executeAt.getTime() - Date.now();

      const actualDelayMs = Math.max(0, remainingDelay);

      // Create a record in the database
      const timeDelayExecution =
        await this.globalRepository.createTimeDelayExecution({
          tagAutomationRuleId: ruleId,
          columnId,
          executeAt,
        });
      // Add job to Redis queue with calculated delay
      const job = await this.timeDelayQueue.add(
        'process-tag-time-delay',
        {
          executionId: timeDelayExecution.id,
          ruleId,
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
        `Scheduled time delay job ${job.id} for in column ${columnId} with delay ${delayInSeconds} seconds`,
      );

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(`Failed to schedule time delay: ${error.message}`);
      throw error;
    }
  }

  // This method is used to update the tag automation trigger
  async update(body: UpdateTagAutomationTriggerDto) {
    const { companyId, columnId, leadId } = body || {};
    this.logger.log(`Tag automation triggered for  Id ${leadId}!`);

    //Use cache for rules list
    const rulesCacheKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(rulesCacheKey);

    let tagAutomationRules: any[] | null = null;
    if (cachedRules) {
      tagAutomationRules = JSON.parse(cachedRules);
      this.logger.log(
        `Loaded tag automation rules from cache: ${rulesCacheKey}`,
      );
    } else {
      tagAutomationRules =
        await this.tagAutomationTriggerRepository.findAllRule(companyId);

      await this.cacheManager.set(
        rulesCacheKey,
        JSON.stringify(tagAutomationRules),
        this.CACHE_TTL * 1000,
      );

      this.logger.log(
        `Cache set for tag automation rules trigger: ${rulesCacheKey}`,
      );
    }

    if (!tagAutomationRules || tagAutomationRules.length === 0) {
      this.logger.warn(
        'No applicable active tag automation rule found for this company',
      );
      return;
    }

    const applicableRule = tagAutomationRules.find(
      (rule: InvoiceAutomationRule) =>
        rule?.invoiceStatusId == columnId && rule.companyId == companyId,
    );

    if (!applicableRule) {
      this.logger.warn(
        `No applicable active tag automation rule found for this !`,
      );
      return;
    }

    if (applicableRule.isPaused) {
      this.logger.warn('The rule is paused!');
      return;
    }

    this.logger.log(
      `Scheduling time delay for  ${leadId} with delay ${applicableRule.timeDelay} seconds`,
    );

    await this.scheduleTimeDelay({
      ruleId: applicableRule.id,
      columnId,
      companyId,
      leadId,
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
