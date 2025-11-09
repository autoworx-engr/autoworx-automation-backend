/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { TagAutomationTriggerRepository } from '../repository/tag-automation-trigger.repository';
import { IScheduleTimeDelay } from 'src/modules/automations/communication-automation/communication-automation-trigger/interfaces/communication-automation-trigger.interface';
import { UpdateTagAutomationTriggerDto } from '../dto/update-tag-automation-trigger.dto';
import { Column, Lead, TagAutomationRule } from '@prisma/client';

@Injectable()
export class TagAutomationTriggerService {
  private readonly logger: LoggerService = new Logger();
  private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
  private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
  private readonly CACHE_TTL = 3600;

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
    conditionType,
  }: IScheduleTimeDelay): Promise<{ jobId: string } | undefined> {
    try {
      const lead = await this.globalRepository.findLeadById(leadId, companyId);

      if (!lead) {
        this.logger.warn('The lead not found!');
        return;
      }

      const baseTime = lead?.columnChangedAt || new Date();

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
          leadId,
          conditionType,
        },
        {
          delay: actualDelayMs,
          jobId: `${timeDelayExecution.id}`,
          removeOnComplete: true,
        },
      );

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

  async triggerPipelineAutomation(rule: TagAutomationRule, lead: Lead) {
    console.log('pipeline', rule, lead);
    // Move lead to new pipeline column
    // await prisma.lead.update({
    //   where: { id: lead.id },
    //   data: { columnId: rule.tagAutomationPipeline.targetColumnId },
    // });

    await this.scheduleTimeDelay({
      ruleId: rule.id,
      columnId: lead.columnId!,
      companyId: rule?.companyId,
      leadId: lead?.id,
      delayInSeconds:
        (rule.timeDelay as string | number) === 'Immediate'
          ? 0
          : Number(rule.timeDelay ?? 0),
      conditionType: rule?.condition_type,
    });
    return {
      statusCode: 200,
      message: 'Time delay scheduling for post tag condition successfully',
    };
  }

  async sendAutomationCommunication(rule: TagAutomationRule, lead: Lead) {
    console.log('communication', rule, lead);
    // const { communicationType, subject, emailBody, smsBody } =
    //   rule.tagAutomationCommunication;
    // if (communicationType === "email") {
    //   await sendEmail({
    //     to: lead.email,
    //     subject,
    //     body: emailBody,
    //   });
    // } else if (communicationType === "sms") {
    //   await sendSMS({
    //     to: lead.phone,
    //     message: smsBody,
    //   });
    // }

    await this.scheduleTimeDelay({
      ruleId: rule.id,
      columnId: lead.columnId!,
      companyId: rule?.companyId,
      leadId: lead?.id,
      delayInSeconds:
        (rule.timeDelay as string | number) === 'Immediate'
          ? 0
          : Number(rule.timeDelay ?? 0),

      conditionType: rule?.condition_type,
    });
    return {
      statusCode: 200,
      message: 'Time delay scheduling for post tag condition successfully',
    };
  }

  async addTagsToLead(rule: TagAutomationRule, lead: Lead) {
    console.log('post tag', rule, lead);
    // await prisma.lead.update({
    //   where: { id: lead.id },
    //   data: {
    //     tags: {
    //       connect: tags.map((t) => ({ id: t.id })),
    //     },
    //   },
    // });

    await this.scheduleTimeDelay({
      ruleId: rule.id,
      columnId: lead.columnId!,
      companyId: rule?.companyId,
      leadId: lead?.id,
      delayInSeconds:
        (rule.timeDelay as string | number) === 'Immediate'
          ? 0
          : Number(rule.timeDelay ?? 0),
      conditionType: rule?.condition_type,
    });
    return {
      statusCode: 200,
      message: 'Time delay scheduling for post tag condition successfully',
    };
  }

  // This method is used to update the tag automation trigger
  async update(body: UpdateTagAutomationTriggerDto) {
    const { companyId, columnId, leadId, pipelineType } = body || {};
    this.logger.log(`Tag automation triggered for  Id ${leadId}!`);

    const lead = await this.globalRepository.findLeadById(leadId, companyId);

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
        await this.tagAutomationTriggerRepository.findAllRule(
          companyId,
          pipelineType,
        );

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

    for (const rule of tagAutomationRules) {
      // PIPELINE CONDITION
      if (
        rule.condition_type === 'pipeline' &&
        rule.tagAutomationPipeline?.targetColumnId === columnId &&
        rule.tag.some((t) => lead.leadTags.some((lt) => lt.tagId === t.id))
      ) {
        await this.triggerPipelineAutomation(rule, lead);
      }

      // COMMUNICATION CONDITION
      else if (
        rule.condition_type === 'communication' &&
        rule.tag.some((t) => lead.leadTags.some((lt) => lt.tagId === t.id))
      ) {
        await this.sendAutomationCommunication(rule, lead);
      }

      // POSTTAG CONDITION
      else if (
        rule.condition_type === 'post_tag' &&
        rule.PostTagAutomationColumn.some((postTag) =>
          postTag?.columnIds.some((c: Column) => c?.id === columnId),
        )
      ) {
        await this.addTagsToLead(rule, lead);
      }
    }
  }
}
