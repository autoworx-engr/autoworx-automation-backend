import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as moment from 'moment-timezone';
import { PrismaService } from 'src/prisma/prisma.service';
import { AutoClockOutJobDataDto } from './dto/auto-clockout-job-data.dto';

@Injectable()
export class AutoClockOutService {
  constructor(
    @InjectQueue('auto-clockout-queue') private autoClockOutQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async getOfficeEndTime(
    companyId: number,
  ): Promise<{ hour: number; minute: number }> {
    const settings = await this.prisma.calendarSettings.findUnique({
      where: { companyId },
    });
    // Default to 19:00 if not set
    if (!settings || !settings.dayEnd) return { hour: 19, minute: 0 };
    // Assume dayEnd is in format 'HH:mm' (e.g., '19:00')
    const [hour, minute] = settings.dayEnd.split(':').map(Number);
    return { hour: hour ?? 19, minute: minute ?? 0 };
  }

  async scheduleAutoClockOut(
    clockInOutId: number,
    userId: number,
    companyId: number,
    clockIn: Date,
    timezone: string,
  ) {
    const officeEndTime = await this.getOfficeEndTime(companyId);
    const officeEnd = moment(clockIn).tz(timezone).set({
      hour: officeEndTime?.hour,
      minute: officeEndTime?.minute,
      second: 0,
      millisecond: 0,
    });
    const now = moment().tz(timezone);
    if (moment(clockIn).isAfter(officeEnd)) return;
    if (now.isAfter(officeEnd)) return;
    const delay = officeEnd.diff(now);
    if (delay <= 0) return;
    const jobData: AutoClockOutJobDataDto = {
      clockInOutId,
      userId,
      companyId,
      clockIn: clockIn.toISOString(),
      timezone,
    };
    await this.autoClockOutQueue.add('auto-clockout', jobData, {
      delay,
      jobId: `auto-clockout-${clockInOutId}`,
    });
  }
}
