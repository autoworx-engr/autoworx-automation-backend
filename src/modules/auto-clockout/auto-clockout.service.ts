import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, LoggerService } from '@nestjs/common';
import { Queue } from 'bull';
import * as moment from 'moment-timezone';
import { PrismaService } from 'src/prisma/prisma.service';
import { AutoClockOutJobDataDto } from './dto/auto-clockout-job-data.dto';

@Injectable()
export class AutoClockOutService {
  private readonly logger: LoggerService = new Logger();
  constructor(
    @InjectQueue('auto-clockout-queue') private autoClockOutQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  // async getOfficeEndTime(
  //   companyId: number,
  // ): Promise<{ hour: number; minute: number }> {
  //   const settings = await this.prisma.calendarSettings.findUnique({
  //     where: { companyId },
  //   });

  //   // Default to 19:00 if not set
  //   if (!settings || !settings.dayEnd) {
  //     return { hour: 19, minute: 0 };
  //   }
  //   // Assume dayEnd is in format 'HH:mm' (e.g., '19:00')
  //   const [hour, minute] = settings.dayEnd.split(':').map(Number);
  //   return { hour: hour ?? 19, minute: minute ?? 0 };
  // }

  async scheduleAutoClockOut(
    clockInOutId: number,
    userId: number,
    companyId: number,
    clockIn: Date,
    timezone: string,
  ) {
    const now = moment().tz(timezone);

    const targetTime = moment
      .tz(clockIn, timezone)
      .clone()
      .add(1, 'day')
      .startOf('day');

    this.logger.log(
      ` Scheduling auto clock out for midnight: ${targetTime.format('YYYY-MM-DD HH:mm:ss')}`,
    );

    // Skip if clock-in is after target time
    if (moment(clockIn).isAfter(targetTime)) {
      this.logger.warn(
        `Clock-in time (${moment(clockIn).format()}) is after target time (${targetTime.format()}). Skipping auto clock out.`,
      );
      return;
    }

    // Skip if current time is already past target time
    if (now.isAfter(targetTime)) {
      this.logger.warn(
        `Current time (${now.format()}) is already past target time (${targetTime.format()}). Skipping auto clock out.`,
      );
      return;
    }

    // Calculate delay in milliseconds
    const delay = targetTime.diff(now);

    if (delay > 0) {
      const jobData: AutoClockOutJobDataDto = {
        clockInOutId,
        userId,
        companyId,
        clockIn: clockIn.toISOString(),
        timezone,
        officeEnd: targetTime.toISOString(),
      };

      this.logger.log(`Scheduling auto clock out with job data:`, jobData);

      const job = await this.autoClockOutQueue.add('auto-clockout', jobData, {
        delay,
        jobId: `auto-clockout-${clockInOutId}`,
      });

      this.logger.log(
        `Auto clock out job scheduled successfully!
         - Job ID: ${job?.id}
         - Clock In/Out ID: ${clockInOutId}
         - User ID: ${userId}
         - Company ID: ${companyId}
         - Timezone: ${timezone}
         - Target Time: ${targetTime.format('YYYY-MM-DD HH:mm:ss')}
         - Delay: ${delay}ms (${moment.duration(delay).humanize()})
         - Will execute at: ${targetTime.format('YYYY-MM-DD HH:mm:ss')}`,
      );

      return job;
    } else {
      this.logger.warn(
        `Delay is ${delay}ms (not positive). Cannot schedule auto clock out.`,
      );
    }
  }
}
