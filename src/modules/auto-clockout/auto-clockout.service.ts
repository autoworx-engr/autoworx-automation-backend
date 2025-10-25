import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as moment from 'moment-timezone';
import { AutoClockOutJobDataDto } from './dto/auto-clockout-job-data.dto';

@Injectable()
export class AutoClockOutService {
  constructor(
    @InjectQueue('auto-clockout-queue') private autoClockOutQueue: Queue,
  ) {}

  async scheduleAutoClockOut(
    clockInOutId: number,
    userId: number,
    companyId: number,
    clockIn: Date,
    timezone: string,
  ) {
    // Office hours: 10:00 AM to 7:00 PM
    const officeEnd = moment(clockIn)
      .tz(timezone)
      .set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
    const now = moment().tz(timezone);
    // If clockIn is after office end, do not schedule
    if (moment(clockIn).isAfter(officeEnd)) return;
    // If already past office end, do not schedule
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
