import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { UpdateCommunicationAutomationTriggerDto } from './dto/update-communication-automation-trigger.dto';
import { CommunicationAutomationTriggerRepository } from './repository/communication-automation-trigger.repository';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { IScheduleTimeDelay } from './interfaces/communication-automation-trigger.interface';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CommunicationAutomationService } from '../communication-automation-rule/communication-automation.service';
import * as moment from 'moment-timezone';

@Injectable()
export class CommunicationAutomationTriggerService {
  private readonly logger = new Logger(
    CommunicationAutomationTriggerService.name,
  );

  private readonly RULES_LIST_KEY = 'communication_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @InjectQueue('communication-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly globalRepository: GlobalRepository,
    private readonly communicationAutomationTriggerRepository: CommunicationAutomationTriggerRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(forwardRef(() => CommunicationAutomationService))
    private readonly communicationAutomationService: CommunicationAutomationService,
  ) {}

  // schedules a time delay for a lead
  async scheduleTimeDelay({
    ruleId,
    leadId,
    columnId,
    companyId,
    delayInSeconds,
  }: IScheduleTimeDelay): Promise<{ jobId: string }> {
    try {
      // Get the lead with column change time
      const lead = await this.globalRepository.findLeadById(leadId, companyId);

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      // Base time from which to calculate the delay
      // Default to current time if columnChangedAt is null
      const baseTime = lead.columnChangedAt || new Date();

      // Calculate the execution date using the local method
      let executeAt;

      if (ruleId) {
        // Use the local method that handles weekend days and active hours
        executeAt = await this.getAdjustedExecutionDate(
          ruleId,
          baseTime,
          delayInSeconds,
        );
        this.logger.log(
          `Using local method to calculate execution date: ${executeAt}`,
        );
      } else {
        // For non-communication rules, use simple calculation
        executeAt = new Date(baseTime.getTime() + delayInSeconds * 1000);
      }

      // Calculate remaining delay in milliseconds
      const remainingDelay = executeAt.getTime() - Date.now();
      // If the executeAt time is in the past, execute immediately
      const actualDelayMs = Math.max(0, remainingDelay);

      // Create a record in the database
      const timeDelayExecution =
        await this.globalRepository.createTimeDelayExecution({
          communicationRuleId: ruleId,
          leadId,
          columnId,
          executeAt,
        });
      // Add job to Redis queue with calculated delay
      const job = await this.timeDelayQueue.add(
        'process-communication-time-delay',
        {
          executionId: timeDelayExecution.id,
          ruleId,
          leadId,
          columnId,
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

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(
        `Error scheduling time delay for lead ${leadId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Updates the communication automation trigger based on lead column changes
   *
   * Behavior:
   * 1. Multiple rules can be triggered for the same column change
   * 2. Rules are grouped into two categories:
   *    - Rules without targetColumnId: These will always execute regardless of column changes
   *    - Rules with targetColumnId: These will only execute if the lead is still in the original column
   * 3. If a rule with targetColumnId executes and moves the lead to a different column,
   *    any pending rules with targetColumnId will be cancelled when their time comes to execute
   *
   * Example scenario:
   * - If there are 3 rules for the same column: 1 minute delay (no target), 15 minute delay (has target), 30 minute delay (no target)
   * - All 3 will be scheduled
   * - The 1-minute rule will execute first
   * - The 15-minute rule will execute and move the lead to a different column
   * - The 30-minute rule will still execute because it has no targetColumnId requirement
   *
   * @param body The DTO containing companyId, leadId, and columnId
   * @returns Status object with message
   */
  async update(body: UpdateCommunicationAutomationTriggerDto) {
    const { companyId, leadId, columnId } = body || {};
    this.logger.log(
      `Communication automation triggered for lead ID ${leadId}!`,
    );
    //Use cache for rules list
    const rulesCacheKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(rulesCacheKey);

    let communicationAutomationRules: any[] | null = null;
    if (cachedRules) {
      communicationAutomationRules = JSON.parse(cachedRules);
      this.logger.log(
        `Loaded communication automation rules from cache: ${rulesCacheKey}`,
      );
    } else {
      communicationAutomationRules =
        await this.communicationAutomationTriggerRepository.findAllRule(
          companyId,
        );

      await this.cacheManager.set(
        rulesCacheKey,
        JSON.stringify(communicationAutomationRules),
        this.CACHE_TTL * 1000,
      );

      this.logger.log(
        `Cache set for communication automation rules trigger: ${rulesCacheKey}`,
      );
    }

    if (
      !communicationAutomationRules ||
      communicationAutomationRules.length === 0
    ) {
      throw new NotFoundException('No active rule found for this company');
    }

    // Find all applicable rules for the column instead of just one
    const applicableRules = communicationAutomationRules.filter((rule) => {
      return (
        rule?.stages?.some((stage) => stage.columnId === columnId) &&
        !rule.isPaused
      );
    });

    if (applicableRules.length === 0) {
      throw new NotFoundException(
        'No applicable active rule found for this column',
      );
    }

    // For all rules, check if they should run now based on weekday/active hours restrictions
    // For rules that can't run now, we'll reschedule them instead of skipping
    const eligibleRules: any[] = [];
    const rulesToReschedule: any[] = [];

    for (const rule of applicableRules) {
      // Check if rule has weekday restrictions and whether it should run now

      if (rule.isSendWeekDays || rule.isSendOfficeHours) {
        try {
          const shouldExecute = await this.shouldExecuteAutomation(
            rule.id,
            new Date(),
          );

          if (!shouldExecute) {
            this.logger.log(
              `Rule ${rule.id} cannot execute now (weekend/outside active hours). Will reschedule for next valid time.`,
            );
            rulesToReschedule.push(rule);
            continue; // Skip this rule for immediate execution
          }
        } catch (error) {
          this.logger.error(
            `Error checking if rule ${rule.id} should execute: ${error.message}`,
          );
          continue; // Skip this rule on error
        }
      }

      // If we get here, the rule is eligible to run immediately
      eligibleRules.push(rule);
    }

    // Schedule rules that can run immediately
    const scheduleResults: { jobId: string }[] = [];

    // Process eligible rules first
    if (eligibleRules.length > 0) {
      // Group rules by whether they have targetColumnId or not
      const rulesWithTargetColumn = eligibleRules.filter(
        (rule) => rule.targetColumnId,
      );
      const rulesWithoutTargetColumn = eligibleRules.filter(
        (rule) => !rule.targetColumnId,
      );

      // Process rules without targetColumnId first (these will always run)
      for (const rule of rulesWithoutTargetColumn) {
        this.logger.log(
          `Scheduling time delay for lead ${leadId} with delay ${rule.timeDelay} seconds (no target column)`,
        );

        const result = await this.scheduleTimeDelay({
          ruleId: rule.id,
          leadId,
          columnId,
          companyId,
          delayInSeconds: rule.timeDelay,
        });

        scheduleResults.push(result);
      }

      // Process rules with targetColumnId (these may be cancelled if column changes)
      for (const rule of rulesWithTargetColumn) {
        this.logger.log(
          `Scheduling time delay for lead ${leadId} with delay ${rule.timeDelay} seconds (target column: ${rule.targetColumnId})`,
        );

        const result = await this.scheduleTimeDelay({
          ruleId: rule.id,
          leadId,
          columnId,
          companyId,
          delayInSeconds: rule.timeDelay,
        });

        scheduleResults.push(result);
      }
    }

    // Now handle rules that need to be rescheduled for next valid time
    for (const rule of rulesToReschedule) {
      try {
        this.logger.log(
          `Rescheduling rule ${rule.id} for next valid business time`,
        );

        // Calculate when the rule should actually execute (next valid business time)
        const nextValidTime = await this.getAdjustedExecutionDate(
          rule.id,
          new Date(), // Use current time as base
          rule.timeDelay, // Add the original delay
        );

        // Calculate delay in milliseconds from now
        const delayMs = Math.max(0, nextValidTime.getTime() - Date.now());

        // Create a database record for this scheduled execution
        const timeDelayExecution =
          await this.globalRepository.createTimeDelayExecution({
            communicationRuleId: rule.id,
            leadId,
            columnId,
            executeAt: nextValidTime,
          });

        // Add job to Redis queue with calculated delay
        const job = await this.timeDelayQueue.add(
          'process-communication-time-delay',
          {
            executionId: timeDelayExecution.id,
            ruleId: rule.id,
            leadId,
            columnId,
            companyId,
          },
          {
            delay: delayMs,
            jobId: `${timeDelayExecution.id}`,
            removeOnComplete: true,
          },
        );

        // Update the record with the job ID
        await this.globalRepository.updateTimeDelayExecution(
          timeDelayExecution.id,
          job.id.toString(),
        );

        scheduleResults.push({ jobId: job.id.toString() });

        this.logger.log(
          `Successfully rescheduled rule ${rule.id} for ${nextValidTime}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to reschedule rule ${rule.id}: ${error.message}`,
        );
        // Continue with other rules even if one fails
      }
    }

    const totalScheduled = scheduleResults.length;
    const immediateRules = eligibleRules.length;
    const rescheduledRules = rulesToReschedule.length;

    return {
      statusCode: 200,
      message: `${totalScheduled} rule(s) scheduled successfully (${immediateRules} immediate, ${rescheduledRules} rescheduled for next business time)`,
    };
  }

  /**
   * Check for communication rules in the target column and execute them
   * This is called after a lead has been moved to a new column by a rule with targetColumnId
   *
   * @param companyId The company ID
   * @param leadId The lead ID
   * @param targetColumnId The target column ID where the lead has been moved
   */
  async checkAndExecuteCommunicationRulesInTargetColumn(
    companyId: number,
    leadId: number,
    targetColumnId: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `Checking for communication rules in target column ${targetColumnId} for lead ${leadId}`,
      );

      // Use cache for rules list
      const rulesCacheKey = `${this.RULES_LIST_KEY}${companyId}`;
      const cachedRules = await this.cacheManager.get<string>(rulesCacheKey);

      let communicationAutomationRules: any[] | null = null;
      if (cachedRules) {
        communicationAutomationRules = JSON.parse(cachedRules);
        this.logger.log(
          `Loaded communication automation rules from cache: ${rulesCacheKey}`,
        );
      } else {
        communicationAutomationRules =
          await this.communicationAutomationTriggerRepository.findAllRule(
            companyId,
          );

        await this.cacheManager.set(
          rulesCacheKey,
          JSON.stringify(communicationAutomationRules),
          this.CACHE_TTL * 1000,
        );

        this.logger.log(
          `Cache set for communication automation rules in target column: ${rulesCacheKey}`,
        );
      }

      if (
        !communicationAutomationRules ||
        communicationAutomationRules.length === 0
      ) {
        this.logger.log(
          `No active communication rules found for company ${companyId}`,
        );
        return;
      }

      // Find all applicable rules for the target column
      const applicableRules = communicationAutomationRules.filter((rule) => {
        return (
          rule?.stages?.some((stage) => stage.columnId === targetColumnId) &&
          !rule.isPaused
        );
      });

      if (applicableRules.length === 0) {
        this.logger.log(
          `No applicable active communication rules found for target column ${targetColumnId}`,
        );
        return;
      }

      this.logger.log(
        `Found ${applicableRules.length} applicable communication rules for target column ${targetColumnId}`,
      );

      // Schedule all applicable rules (respecting time restrictions)
      for (const rule of applicableRules) {
        this.logger.log(
          `Scheduling communication time delay for lead ${leadId} in target column ${targetColumnId} with delay ${rule.timeDelay} seconds`,
        );

        // The scheduleTimeDelay method will handle time restrictions via getAdjustedExecutionDate
        await this.scheduleTimeDelay({
          ruleId: rule.id,
          leadId,
          columnId: targetColumnId,
          companyId,
          delayInSeconds: rule.timeDelay,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to check and execute communication rules in target column: ${error.message}`,
      );
      // Don't throw the error to avoid disrupting the main flow
    }
  }

  /**
   * Checks if a given date is a weekend day according to company calendar settings
   * @param companyId The ID of the company
   * @param date The date to check
   * @returns True if the date is a weekend day, false otherwise
   */
  async isWeekendDay(
    companyId: number,
    date: Date = new Date(),
  ): Promise<boolean> {
    // Get company's timezone
    const tz =
      await this.communicationAutomationTriggerRepository.getCompanyTimezone(
        companyId,
      );
    const currentDayOfWeek = moment.tz(date, tz).day();

    // Get the company's calendar settings using the repository
    const calendarSettings =
      await this.communicationAutomationTriggerRepository.getWeekendDaysForCompany(
        companyId,
      );

    if (!calendarSettings) {
      this.logger.warn(
        `No calendar settings found for company ${companyId}. Using default weekend days.`,
      );
      // Default to Saturday and Sunday as weekend days
      return currentDayOfWeek === 0 || currentDayOfWeek === 6;
    }

    // Convert weekend day names to day numbers using moment
    const weekend1DayNum = moment()
      .day(calendarSettings.weekend1.toLowerCase())
      .day();
    const weekend2DayNum = moment()
      .day(calendarSettings.weekend2.toLowerCase())
      .day();

    this.logger.debug(
      `Checking weekend: Current day ${currentDayOfWeek}, Weekend days: ${calendarSettings.weekend1} (${weekend1DayNum}), ${calendarSettings.weekend2} (${weekend2DayNum})`,
    );

    // Check if the current day is a weekend day
    return (
      currentDayOfWeek === weekend1DayNum || currentDayOfWeek === weekend2DayNum
    );
  }

  /**
   * Determines if a communication automation should be executed based on office hours
   * If isWeekdays is enabled, weekends are completely off
   * If isWeekdays is disabled, communications can be sent during weekend office hours
   * @param ruleId The ID of the communication automation rule
   * @param date The date to check
   * @returns True if the automation should be executed, false otherwise
   */
  async shouldExecuteAutomation(
    ruleId: number,
    date: Date = new Date(),
  ): Promise<boolean> {
    const rule = await this.communicationAutomationService.findOne(ruleId);

    // If rule doesn't exist or is paused, don't execute
    if (!rule || rule.isPaused) {
      return false;
    }

    // If isSendWeekDays is enabled, check if today is a weekend - if so, don't execute at all
    if (rule.isSendWeekDays) {
      const isWeekend = await this.isWeekendDay(rule.companyId, date);
      if (isWeekend) {
        this.logger.log(
          `Rule ${ruleId} not executed because today is a weekend day and isSendWeekDays is enabled (weekend is completely off)`,
        );
        return false;
      }
    }
    return await this.timeExecute(rule, date);
  }

  async timeExecute(
    rule: { companyId: number; isSendOfficeHours: boolean },
    date: Date = new Date(),
  ) {
    // If isSendOfficeHours is false, allow execution at any time
    if (!rule.isSendOfficeHours) {
      this.logger.debug(
        `Rule allows execution outside office hours (isSendOfficeHours: false)`,
      );
      return true;
    }

    // Only check office hours if isSendOfficeHours is true
    const calendarSettings =
      await this.communicationAutomationTriggerRepository.getCalendarSettings(
        rule.companyId,
      );
    const tz =
      await this.communicationAutomationTriggerRepository.getCompanyTimezone(
        rule.companyId,
      );
    const now = moment.tz(date, tz);

    if (!calendarSettings) {
      this.logger.warn(
        `No calendar settings found for company ${rule.companyId}. Cannot execute automation without office hours.`,
      );
      return false; // Don't execute if no calendar settings
    }

    // Parse active hours from calendar settings
    const currentHour = now.hour();
    const currentMinutes = now.minute();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;
    // Parse dayStart and dayEnd from HH:MM format to minutes
    // Handle both formats: "10:00" and just "10"
    const [startHour, startMinute = 0] = calendarSettings.dayStart.includes(':')
      ? calendarSettings.dayStart.split(':').map(Number)
      : [parseInt(calendarSettings.dayStart, 10), 0];
    const [endHour, endMinute = 0] = calendarSettings.dayEnd.includes(':')
      ? calendarSettings.dayEnd.split(':').map(Number)
      : [parseInt(calendarSettings.dayEnd, 10), 0];
    const dayStartMinutes = startHour * 60 + startMinute;
    const dayEndMinutes = endHour * 60 + endMinute;
    this.logger.debug(
      `Checking office hours: Current time ${currentHour}:${currentMinutes} (${currentTimeMinutes} mins), ` +
        `Office hours: ${startHour}:${startMinute} (${dayStartMinutes} mins) - ${endHour}:${endMinute} (${dayEndMinutes} mins)`,
    );
    // Check if current time is within office hours
    const isWithinOfficeHours =
      currentTimeMinutes >= dayStartMinutes &&
      currentTimeMinutes <= dayEndMinutes;
    if (!isWithinOfficeHours) {
      this.logger.log(
        `Rule not executed because current time is outside office hours`,
      );
      return false;
    }

    return true;
  }

  /**
   * Gets the adjusted execution date for a communication rule
   * Only reschedules based on flags: isSendWeekDays and isSendOfficeHours
   * If both flags are false, executes at any time without restrictions
   * @param ruleId The ID of the communication automation rule
   * @param baseDate The base date to start from
   * @param delaySeconds The delay in seconds
   * @returns The adjusted execution date based on rule settings
   */
  async getAdjustedExecutionDate(
    ruleId: number,
    baseDate: Date,
    delaySeconds: number,
  ): Promise<Date> {
    const rule = await this.communicationAutomationService.findOne(ruleId);

    if (!rule) {
      throw new NotFoundException(
        `Communication rule with ID ${ruleId} not found`,
      );
    }

    // Calculate initial execution date in company timezone
    const tz =
      await this.communicationAutomationTriggerRepository.getCompanyTimezone(
        rule.companyId,
      );
    let executeAt = moment.tz(baseDate, tz).add(delaySeconds, 'seconds');

    // If both flags are false, execute at any time without restrictions
    if (!rule.isSendWeekDays && !rule.isSendOfficeHours) {
      this.logger.log(
        `Rule ${ruleId} has no time restrictions (both isSendWeekDays and isSendOfficeHours are false). Executing at calculated time: ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`,
      );
      return executeAt.toDate();
    }

    // Get calendar settings only if we need them (when at least one flag is true)
    const calendarSettings =
      await this.communicationAutomationTriggerRepository.getCalendarSettings(
        rule.companyId,
      );

    if (!calendarSettings && (rule.isSendWeekDays || rule.isSendOfficeHours)) {
      this.logger.warn(
        `No calendar settings found for company ${rule.companyId}. Cannot schedule automation with time restrictions.`,
      );
      // If no calendar settings but flags are enabled, schedule for next day at 9 AM as fallback
      executeAt = executeAt
        .clone()
        .add(1, 'day')
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0);
      return executeAt.toDate();
    }

    // Parse dayStart and dayEnd from HH:MM format only if we have calendar settings
    // Handle both formats: "10:00" and just "10"
    const [startHour, startMinute = 0] = calendarSettings!.dayStart.includes(':')
      ? calendarSettings!.dayStart.split(':').map(Number)
      : [parseInt(calendarSettings!.dayStart, 10), 0];

    const [endHour, endMinute = 0] = calendarSettings!.dayEnd.includes(':')
      ? calendarSettings!.dayEnd.split(':').map(Number)
      : [parseInt(calendarSettings!.dayEnd, 10), 0];

    // If isSendWeekDays is enabled, check if we're on a weekend and skip to next weekday
    if (rule.isSendWeekDays) {
      // Get weekend configuration from calendar settings
      const weekend1DayNum = moment()
        .day(calendarSettings!.weekend1.toLowerCase())
        .day();
      const weekend2DayNum = moment()
        .day(calendarSettings!.weekend2.toLowerCase())
        .day();

      // Check if executeAt falls on a configured weekend day
      let dayOfWeek = executeAt.day();
      let daysToAdd = 0;

      if (dayOfWeek === weekend1DayNum || dayOfWeek === weekend2DayNum) {
        // Calculate how many days to add to get to the next weekday
        daysToAdd = 1;

        // Check if the next day is also a weekend
        const nextDayOfWeek = (dayOfWeek + 1) % 7;
        if (
          nextDayOfWeek === weekend1DayNum ||
          nextDayOfWeek === weekend2DayNum
        ) {
          daysToAdd = 2;
        }

        executeAt.add(daysToAdd, 'days');
        this.logger.debug(
          `Rescheduled automation to skip weekend (isSendWeekDays enabled): ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`,
        );
      }
    }

    // Only adjust for office hours if isSendOfficeHours is enabled
    if (rule.isSendOfficeHours) {
      // Create moment objects for the start and end of office hours for the executeAt date
      const officeStartTime = executeAt
        .clone()
        .hour(startHour)
        .minute(startMinute)
        .second(0)
        .millisecond(0);
      const officeEndTime = executeAt
        .clone()
        .hour(endHour)
        .minute(endMinute)
        .second(0)
        .millisecond(0);

      // If the execution time is before office hours, move it to the start of office hours
      if (executeAt.isBefore(officeStartTime)) {
        executeAt = officeStartTime.clone();
        this.logger.debug(
          `Rescheduled automation to office start time: ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`,
        );
      }

      // If the execution time is after office hours, move it to the start of office hours on the next day
      if (executeAt.isAfter(officeEndTime)) {
        executeAt = officeStartTime.clone().add(1, 'day');
        this.logger.debug(
          `Rescheduled automation to next day office start time: ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`,
        );

        // If isSendWeekDays is enabled and the next day is weekend, skip to next weekday
        if (rule.isSendWeekDays) {
          const weekend1DayNum = moment()
            .day(calendarSettings!.weekend1.toLowerCase())
            .day();
          const weekend2DayNum = moment()
            .day(calendarSettings!.weekend2.toLowerCase())
            .day();

          const nextDayOfWeek = executeAt.day();
          let daysToAdd = 0;

          if (
            nextDayOfWeek === weekend1DayNum ||
            nextDayOfWeek === weekend2DayNum
          ) {
            daysToAdd = 1;
            const dayAfterNext = (nextDayOfWeek + 1) % 7;
            if (
              dayAfterNext === weekend1DayNum ||
              dayAfterNext === weekend2DayNum
            ) {
              daysToAdd = 2;
            }
            executeAt.add(daysToAdd, 'days');
            this.logger.debug(
              `Rescheduled automation to skip weekend after moving to next day: ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `Final scheduled time for rule ${ruleId}: ${executeAt.format('YYYY-MM-DD HH:mm:ss')} (${tz})`,
    );
    return executeAt.toDate();
  }
}
