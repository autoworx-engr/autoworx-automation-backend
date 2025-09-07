import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DayOfWeek, InventoryAutomationFrequency } from '@prisma/client';
import { NotificationData } from '../interfaces/inventory-trigger.interface';
import { InventoryCheckerService } from './inventory-checker.service';
import { InventoryNotificationService } from './inventory-notification.service';
import { InventoryTriggerRepository } from '../repositories/inventory-trigger.repository';

@Injectable()
export class InventoryTriggerService {
  private readonly logger = new Logger(InventoryTriggerService.name);

  constructor(
    private readonly inventoryRepository: InventoryTriggerRepository,
    private readonly inventoryChecker: InventoryCheckerService,
    private readonly notificationService: InventoryNotificationService,
  ) {}

  /**
   * Daily cron job to check for all inventory automation rules
   * Runs every day at 9:00 AM and processes rules based on their frequency
   * Handles: DAILY, WEEKLY, MONTHLY, EVERY_TWO_MONTHS
   */
  @Cron('0 10 * * *', {
    name: 'inventory-automation-check',
    timeZone: 'UTC',
  })
  async handleInventoryAutomationCheck(): Promise<void> {
    const currentDay = this.getCurrentDayOfWeek();
    const today = new Date();

    this.logger.log(`Starting inventory automation check for ${currentDay}...`);

    try {
      // Always check daily rules
      this.logger.log('Processing daily rules (runs every day)');
      await this.processInventoryRules(InventoryAutomationFrequency.DAILY);

      // Check weekly rules for today's day
      this.logger.log(`Processing weekly rules for ${currentDay} only`);
      await this.processInventoryRules(InventoryAutomationFrequency.WEEKLY);

      // Check monthly and every-two-months rules on the 1st day of the month
      if (today.getDate() === 1) {
        // Monthly rules - run every month
        this.logger.log('Processing monthly rules (runs every month)');
        await this.processInventoryRules(InventoryAutomationFrequency.MONTHLY);

        // Every-two-months rules - run based on creation date + 2 month intervals
        this.logger.log(
          'Processing every-two-months rules (based on creation date)',
        );
        await this.processEveryTwoMonthsRules();
      }

      this.logger.log(
        `Inventory automation check completed successfully for ${currentDay}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in inventory automation check for ${currentDay}:`,
        error,
      );
    }
  }

  /**
   * Process inventory rules for a specific frequency
   */
  private async processInventoryRules(
    frequency: InventoryAutomationFrequency,
  ): Promise<void> {
    // Get current day for weekly frequency filtering
    const currentDay = this.getCurrentDayOfWeek();

    // Get rules by frequency using repository
    const rules = await this.inventoryRepository.getRulesByFrequency(
      frequency,
      frequency === InventoryAutomationFrequency.WEEKLY
        ? currentDay
        : undefined,
    );

    this.logger.log(
      `Found ${rules.length} active rules for frequency: ${frequency}`,
    );

    // Process each rule
    for (const rule of rules) {
      try {
        await this.processIndividualRule(rule);
      } catch (error) {
        this.logger.error(
          `Error processing rule ${rule.id}: ${rule.title}`,
          error,
        );
        // Continue with other rules even if one fails
      }
    }
  }

  /**
   * Process an individual inventory automation rule
   */
  private async processIndividualRule(rule: any): Promise<void> {
    this.logger.log(`Processing rule: ${rule.title} (ID: ${rule.id})`);

    // Check inventory conditions for this company
    const inventoryCheck = await this.inventoryChecker.checkInventoryConditions(
      rule.companyId,
      rule.condition,
    );

    // Check if notification should be triggered
    const shouldTrigger = this.inventoryChecker.shouldTriggerNotification(
      rule.condition,
      inventoryCheck,
    );

    if (!shouldTrigger) {
      this.logger.log(`No inventory issues found for rule: ${rule.title}`);
      return;
    }

    // Get recipients
    const recipients = rule.teamMembers.map((member: any) => ({
      userId: member.user.id,
      name:
        `${member.user.firstName} ${member.user.lastName || ''}`.trim() ||
        'Unknown User',
      email: member.user.email || undefined,
      phone: member.user.phone || undefined,
    }));

    if (recipients.length === 0) {
      this.logger.warn(`No recipients found for rule: ${rule.title}`);
      return;
    }

    // Prepare notification data
    const notificationData: NotificationData = {
      companyId: rule.companyId,
      ruleTitle: rule.title,
      condition: rule.condition,
      lowStockProducts: inventoryCheck.lowStockProducts,
      outOfStockProducts: inventoryCheck.outOfStockProducts,
      recipients,
      action: rule.action,
    };

    // Send notifications
    await this.notificationService.sendNotifications(notificationData);

    this.logger.log(`Notifications sent for rule: ${rule.title}`);
  }

  /**
   * Get current day of week as DayOfWeek enum
   */
  private getCurrentDayOfWeek(): DayOfWeek {
    const days = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];

    const today = new Date();
    return days[today.getDay()];
  }

  /**
   * Manual trigger for inventory check - can be called via API
   */
  async triggerInventoryCheck(ruleId?: number): Promise<void> {
    this.logger.log(
      `Manual inventory check triggered${ruleId ? ` for rule ID: ${ruleId}` : ''}`,
    );

    if (ruleId) {
      // Process specific rule
      const rule = await this.inventoryRepository.getRuleById(ruleId);

      if (!rule) {
        throw new Error(
          `Inventory automation rule with ID ${ruleId} not found`,
        );
      }

      await this.processIndividualRule(rule);
    } else {
      // Process all active rules - mimic the cron job logic exactly

      // Always check daily rules
      await this.processInventoryRules(InventoryAutomationFrequency.DAILY);

      // Check weekly rules for today's day
      await this.processInventoryRules(InventoryAutomationFrequency.WEEKLY);

      // Check monthly and every-two-months rules (manual trigger processes all frequencies)
      await this.processInventoryRules(InventoryAutomationFrequency.MONTHLY);

      // Every-two-months rules - use the special logic
      await this.processEveryTwoMonthsRules();
    }
  }

  /**
   * Process every-two-months rules based on their creation date
   * Rules execute every 2 months from their creation date, but only on the 1st of the month
   */
  private async processEveryTwoMonthsRules(): Promise<void> {
    const rules =
      await this.inventoryRepository.getEveryTwoMonthsRulesForToday();

    this.logger.log(
      `Found ${rules.length} every-two-months rules scheduled for today`,
    );

    if (rules.length === 0) {
      this.logger.log(
        'No every-two-months rules scheduled for today based on creation dates',
      );
      return;
    }

    // Process each rule
    for (const rule of rules) {
      try {
        const createdDate = new Date(rule.createdAt);
        const today = new Date();
        const monthsElapsed =
          (today.getFullYear() - createdDate.getFullYear()) * 12 +
          (today.getMonth() - createdDate.getMonth());

        this.logger.log(
          `Processing every-two-months rule: ${rule.title} (ID: ${rule.id})`,
        );
        this.logger.log(
          `  - Created: ${createdDate.toISOString().split('T')[0]}`,
        );
        this.logger.log(`  - Months elapsed: ${monthsElapsed}`);
        this.logger.log(`  - Company ID: ${rule.companyId}`);

        await this.processIndividualRule(rule);

        this.logger.log(
          `Successfully processed every-two-months rule: ${rule.title}`,
        );
      } catch (error) {
        this.logger.error(
          `Error processing every-two-months rule ${rule.id}: ${rule.title}`,
          error,
        );
        // Continue with other rules even if one fails
      }
    }
  }
}
