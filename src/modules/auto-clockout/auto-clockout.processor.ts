import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import * as moment from 'moment-timezone';
import { PrismaService } from 'src/prisma/prisma.service';
import { AutoClockOutJobDataDto } from './dto/auto-clockout-job-data.dto';

@Processor('auto-clockout-queue')
@Injectable()
export class AutoClockOutProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('auto-clockout')
  async handleAutoClockOut(job: Job<AutoClockOutJobDataDto>) {
    const { clockInOutId, clockIn, timezone } = job.data;
    const tz = timezone || 'Asia/Dhaka';
    // Find the clock-in record
    const record = await this.prisma.clockInOut.findUnique({
      where: { id: clockInOutId },
    });
    if (!record) return;
    // If already clocked out, do nothing
    if (record.clockOut) return;
    // Set clockOut to 7:00 PM of the clockIn day in the given timezone
    const officeEnd = moment(clockIn)
      .tz(tz)
      .set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
    // If user clocked in after 7:00 PM, set clockOut to clockIn + 1 minute (edge case)
    let finalClockOut = officeEnd;
    if (moment(clockIn).isAfter(officeEnd)) {
      finalClockOut = moment(clockIn).add(1, 'minute');
    }
    await this.prisma.clockInOut.update({
      where: { id: clockInOutId },
      data: { clockOut: finalClockOut.toDate() },
    });
  }
}
