/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { TagAutomationTriggerRepository } from '../repository/tag-automation-trigger.repository';
import { IScheduleTimeDelay } from 'src/modules/automations/communication-automation/communication-automation-trigger/interfaces/communication-automation-trigger.interface';
import { UpdateTagAutomationTriggerDto } from '../dto/update-tag-automation-trigger.dto';
import { Column, Lead, TagAutomationRule } from '@prisma/client';
import moment from 'moment';
import { CommunicationAutomationTriggerRepository } from 'src/modules/automations/communication-automation/communication-automation-trigger/repository/communication-automation-trigger.repository';
import { TagAutomationRuleWithRelations } from 'src/common/types/tagAutomationRule';

@Injectable()
export class TagAutomationTriggerService {
  private readonly logger = new Logger(TagAutomationTriggerService.name);
  private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
  private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
  private readonly CACHE_TTL = 3600;

  constructor(
    @InjectQueue('tag-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly globalRepository: GlobalRepository,
    private readonly tagAutomationTriggerRepository: TagAutomationTriggerRepository,
    private readonly communicationAutomationTriggerRepository: CommunicationAutomationTriggerRepository,

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

  async triggerPipelineAutomation(
    rule: TagAutomationRule,
    lead: Lead,
    tagId: number,
  ) {
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
      tagId,
    });
    return {
      statusCode: 200,
      message: 'Time delay scheduling for post tag condition successfully',
    };
  }

  async sendAutomationCommunication(
    rule: TagAutomationRuleWithRelations,
    lead: Lead,
    tagId: number,
  ) {
    const eligibleRules: TagAutomationRuleWithRelations[] = [];
    const rulesToReschedule: TagAutomationRuleWithRelations[] = [];

    // ---Step 1: Check weekday / office hour restrictions ---
    if (
      rule?.tagAutomationCommunication?.isSendWeekDays ||
      rule?.tagAutomationCommunication?.isSendOfficeHours
    ) {
      try {
        const shouldExecute = await this.shouldExecuteTagAutomation(
          rule.id,
          new Date(),
        );

        if (!shouldExecute) {
          this.logger.log(
            `Tag rule ${rule.id} cannot execute now (weekend/outside office hours). Will reschedule.`,
          );
          rulesToReschedule.push(rule);
        } else {
          eligibleRules.push(rule);
        }
      } catch (error) {
        this.logger.error(
          `Error checking execution window for tag rule ${rule.id}: ${error.message}`,
        );
      }
    } else {
      // No time restriction → eligible immediately
      eligibleRules.push(rule);
    }

    const scheduleResults: any[] = [];

    // ---Step 2: Execute or schedule eligible rules immediately ---
    for (const rule of eligibleRules) {
      this.logger.log(
        `Scheduling TagAutomation for lead ${lead.id} immediately with delay ${rule.timeDelay} seconds.`,
      );

      const result = await this.scheduleTimeDelay({
        ruleId: rule.id,
        columnId: lead.columnId!,
        companyId: rule.companyId,
        leadId: lead.id,
        delayInSeconds:
          (rule.timeDelay as string | number) === 'Immediate'
            ? 0
            : Number(rule.timeDelay ?? 0),
        conditionType: rule?.condition_type,
        tagId,
      });

      scheduleResults.push(result);
    }

    // ---Step 3: Handle rules that need to be rescheduled ---
    for (const rule of rulesToReschedule) {
      try {
        this.logger.log(
          `Rescheduling tag rule ${rule.id} for next valid business time.`,
        );

        const nextValidTime = await this.getAdjustedExecutionDateForTag(
          rule.id,
          new Date(),
          (rule.timeDelay as string | number) === 'Immediate'
            ? 0
            : Number(rule.timeDelay ?? 0),
        );

        const delayMs = Math.max(0, nextValidTime.getTime() - Date.now());

        const timeDelayExecution =
          await this.globalRepository.createTimeDelayExecution({
            tagAutomationRuleId: rule.id,
            leadId: lead.id,
            columnId: lead.columnId!,
            executeAt: nextValidTime,
          });

        const job = await this.timeDelayQueue.add(
          'process-tag-time-delay',
          {
            executionId: timeDelayExecution.id,
            ruleId: rule.id,
            leadId: lead.id,
            columnId: lead.columnId!,
            companyId: rule.companyId,
            tagId,
            conditionType: rule?.condition_type,
          },
          {
            delay: delayMs,
            jobId: `${timeDelayExecution.id}`,
            removeOnComplete: true,
          },
        );

        await this.globalRepository.updateTimeDelayExecution(
          timeDelayExecution.id,
          job.id.toString(),
        );

        scheduleResults.push({ jobId: job.id.toString() });

        this.logger.log(
          `Successfully rescheduled tag rule ${rule.id} for ${nextValidTime.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to reschedule tag rule ${rule.id}: ${error.message}`,
        );
      }
    }

    return {
      statusCode: 200,
      message: `${scheduleResults.length} tag automation rule(s) scheduled successfully.`,
    };
  }

  async addTagsToLead(rule: TagAutomationRule, lead: Lead) {
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
    const { companyId, columnId, leadId, pipelineType, tagId } = body || {};
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
        tagId &&
        rule.tagAutomationPipeline?.targetColumnId &&
        rule.tag.some((t) => t.id === tagId)
      ) {
        await this.triggerPipelineAutomation(rule, lead, tagId);
      }

      // COMMUNICATION CONDITION
      else if (
        tagId &&
        rule.condition_type === 'communication' &&
        rule.tag.some((t) => t.id === tagId)
      ) {
        await this.sendAutomationCommunication(rule, lead, tagId);
      }

      // POSTTAG CONDITION
      else if (
        rule.condition_type === 'post_tag' &&
        !tagId &&
        rule.PostTagAutomationColumn.some((postTag) =>
          postTag?.columnIds.some((c: Column) => c?.id === columnId),
        )
      ) {
        await this.addTagsToLead(rule, lead);
      }
    }
  }

  async shouldExecuteTagAutomation(
    ruleId: number,
    date: Date = new Date(),
  ): Promise<boolean> {
    const rule = await this.tagAutomationTriggerRepository.findRuleById(ruleId);

    if (!rule || rule.isPaused) return false;

    const communication = rule.tagAutomationCommunication;
    if (!communication) return true;

    if (communication.isSendWeekDays) {
      const isWeekend = await this.isWeekendDay(rule.companyId, date);
      if (isWeekend) {
        this.logger.log(
          `Tag rule ${ruleId} not executed (weekend & isSendWeekDays enabled).`,
        );
        return false;
      }
    }

    return await this.isWithinOfficeHours(
      rule.companyId,
      date,
      communication.isSendOfficeHours,
    );
  }

  async getAdjustedExecutionDateForTag(
    ruleId: number,
    baseDate: Date,
    delaySeconds: number,
  ): Promise<Date> {
    const rule = await this.tagAutomationTriggerRepository.findRuleById(ruleId);

    if (!rule) {
      throw new NotFoundException(
        `TagAutomation rule with ID ${ruleId} not found`,
      );
    }

    const communication = rule.tagAutomationCommunication;
    const tz =
      await this.communicationAutomationTriggerRepository.getCompanyTimezone(
        rule.companyId,
      );
    let executeAt = moment.tz(baseDate, tz).add(delaySeconds, 'seconds');

    if (!communication?.isSendWeekDays && !communication?.isSendOfficeHours) {
      return executeAt.toDate();
    }

    const calendarSettings =
      await this.communicationAutomationTriggerRepository.getCalendarSettings(
        rule.companyId,
      );

    if (!calendarSettings) {
      executeAt = executeAt
        .clone()
        .add(1, 'day')
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0);
      return executeAt.toDate();
    }

    const [startHour, startMinute = 0] = calendarSettings.dayStart.includes(':')
      ? calendarSettings.dayStart.split(':').map(Number)
      : [parseInt(calendarSettings.dayStart, 10), 0];

    const [endHour, endMinute = 0] = calendarSettings.dayEnd.includes(':')
      ? calendarSettings.dayEnd.split(':').map(Number)
      : [parseInt(calendarSettings.dayEnd, 10), 0];

    // ✅ Handle weekend
    if (communication.isSendWeekDays) {
      const weekend1 = moment()
        .day(calendarSettings.weekend1.toLowerCase())
        .day();
      const weekend2 = moment()
        .day(calendarSettings.weekend2.toLowerCase())
        .day();
      const dayOfWeek = executeAt.day();
      if (dayOfWeek === weekend1 || dayOfWeek === weekend2) {
        executeAt.add(1, 'day');
        const nextDay = executeAt.day();
        if (nextDay === weekend1 || nextDay === weekend2)
          executeAt.add(1, 'day');
      }
    }

    // ✅ Handle office hours
    if (communication.isSendOfficeHours) {
      const officeStart = executeAt
        .clone()
        .hour(startHour)
        .minute(startMinute)
        .second(0);
      const officeEnd = executeAt
        .clone()
        .hour(endHour)
        .minute(endMinute)
        .second(0);

      if (executeAt.isBefore(officeStart)) executeAt = officeStart.clone();
      else if (executeAt.isAfter(officeEnd))
        executeAt = officeStart.clone().add(1, 'day');
    }

    this.logger.log(
      `Final adjusted execution date for tag rule ${ruleId}: ${executeAt.format(
        'YYYY-MM-DD HH:mm:ss',
      )}`,
    );

    return executeAt.toDate();
  }

  async isWeekendDay(companyId: number, date: Date): Promise<boolean> {
    const settings =
      await this.communicationAutomationTriggerRepository.getCalendarSettings(
        companyId,
      );

    if (!settings) {
      // Default weekends: Friday, Saturday (common in BD)
      const weekendDays = [5, 6];
      return weekendDays.includes(moment(date).day());
    }

    const weekend1 = settings.weekend1?.toLowerCase?.();
    const weekend2 = settings.weekend2?.toLowerCase?.();

    const weekendDays: number[] = [];
    if (weekend1) weekendDays.push(moment().day(weekend1).day());
    if (weekend2) weekendDays.push(moment().day(weekend2).day());

    const currentDay = moment(date).day();

    return weekendDays.includes(currentDay);
  }

  async isWithinOfficeHours(
    companyId: number,
    date: Date,
    isOfficeHoursEnabled: boolean,
  ): Promise<boolean> {
    if (!isOfficeHoursEnabled) return true;

    const tz =
      await this.communicationAutomationTriggerRepository.getCompanyTimezone(
        companyId,
      );

    const settings =
      await this.communicationAutomationTriggerRepository.getCalendarSettings(
        companyId,
      );
    if (!settings) return true;

    const now = moment.tz(date, tz);

    const [startHour, startMinute = 0] = settings.dayStart.includes(':')
      ? settings.dayStart.split(':').map(Number)
      : [parseInt(settings.dayStart, 10), 0];

    const [endHour, endMinute = 0] = settings.dayEnd.includes(':')
      ? settings.dayEnd.split(':').map(Number)
      : [parseInt(settings.dayEnd, 10), 0];

    const officeStart = now
      .clone()
      .hour(startHour)
      .minute(startMinute)
      .second(0);
    const officeEnd = now.clone().hour(endHour).minute(endMinute).second(0);

    const isWithinHours = now.isBetween(
      officeStart,
      officeEnd,
      undefined,
      '[]',
    );

    return isWithinHours;
  }
}
