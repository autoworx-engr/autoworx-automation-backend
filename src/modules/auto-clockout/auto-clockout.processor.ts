import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, LoggerService } from '@nestjs/common';
import { Job } from 'bull';
import * as moment from 'moment-timezone';
import { PrismaService } from 'src/prisma/prisma.service';
import { AutoClockOutJobDataDto } from './dto/auto-clockout-job-data.dto';

@Processor('auto-clockout-queue')
@Injectable()
export class AutoClockOutProcessor {
  private readonly logger: LoggerService = new Logger();
  constructor(private readonly prisma: PrismaService) {}

  @Process('auto-clockout')
  async handleAutoClockOut(job: Job<AutoClockOutJobDataDto>) {
    const { clockInOutId, clockIn, officeEnd } = job.data;
    // const tz = timezone || 'Asia/Dhaka';
    // Find the clock-in record
    const record = await this.prisma.clockInOut.findUnique({
      where: { id: clockInOutId },
    });

    if (!record) return;
    // If already clocked out, do nothing
    if (record.clockOut) {
      this.logger.log(`Already clock out`);
      return;
    }

    const clockInMoment = moment(clockIn);
    const officeEndMoment = moment(officeEnd);

    let finalClockOut = officeEndMoment;
    if (clockInMoment.isAfter(officeEndMoment)) {
      finalClockOut = clockInMoment.add(1, 'minute');
    }

    const res = await this.prisma.clockInOut.update({
      where: { id: clockInOutId },
      data: { clockOut: finalClockOut.toDate() },
    });

    if (res?.clockOut) {
      this.logger.log(`Auto clock out updated!`);
    }
  }
}
