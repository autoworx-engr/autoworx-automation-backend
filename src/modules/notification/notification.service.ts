import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly notificationRepo: NotificationRepository) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async autoCleanupOldNotifications() {
    const deleted = await this.notificationRepo.deleteOlderThan30Days();
    this.logger.log(`Auto Cleanup: Deleted ${deleted.count} old notifications`);
  }
}
