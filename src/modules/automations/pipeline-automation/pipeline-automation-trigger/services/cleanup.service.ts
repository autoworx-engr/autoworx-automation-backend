import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {
    this.logger.log(
      '🧹 CleanupService initialized - scheduled to run every 15 days',
    );
  }

  // Run every 15 days at midnight
  // Cron expression: sec min hour day-of-month month day-of-week
  // This runs on the 1st and 16th of each month
  @Cron('0 0 0 1,16 * *')
  async cleanupOldExecutions() {
    this.logger.log('Starting scheduled cleanup of old time delay executions');

    try {
      // Delete completed or failed executions older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.timeDelayExecution.deleteMany({
        where: {
          status: {
            in: [
              ExecutionStatus.COMPLETED,
              ExecutionStatus.FAILED,
              ExecutionStatus.CANCELLED,
            ],
          },
          updatedAt: { lt: thirtyDaysAgo },
        },
      });

      this.logger.log(
        `Cleanup complete: deleted ${result.count} old time delay executions`,
      );
    } catch (error) {
      this.logger.error(`Error cleaning up old executions: ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  // Method to manually trigger cleanup if needed
  async manualCleanup(olderThanDays: number = 30): Promise<number> {
    this.logger.log(
      `Starting manual cleanup of executions older than ${olderThanDays} days`,
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.timeDelayExecution.deleteMany({
        where: {
          status: { in: [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED] },
          updatedAt: { lt: cutoffDate },
        },
      });

      this.logger.log(
        `Manual cleanup complete: deleted ${result.count} old time delay executions`,
      );
      return result.count;
    } catch (error) {
      this.logger.error(`Error during manual cleanup: ${error.message}`);
      throw error;
    }
  }
}
