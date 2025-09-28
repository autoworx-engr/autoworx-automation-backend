import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as moment from 'moment-timezone';

@Injectable()
export class ReminderService {
  constructor(@InjectQueue('reminder-queue') private reminderQueue: Queue) {}

  async scheduleReminders(
    id: string,
    date: string, // e.g. "2025-07-20"
    time: string, // e.g. "15:00"
    timezone: string, // e.g. "Asia/Dhaka"
    when?: 'exact',
    reminderIndex?: number,
  ) {
    try {
      const now = moment().tz(timezone); // current time in target timezone

      // Combine date + time + timezone into one Moment object
      const appointmentDateTime = moment.tz(
        `${date.split('T')[0]} ${time}`, // "2025-07-21 17:27"
        'YYYY-MM-DD HH:mm',
        timezone,
      );

      if (when === 'exact') {
        if (appointmentDateTime.isAfter(now)) {
          return await this.reminderQueue.add(
            'send-reminder',
            { id, when: 'exact' },
            {
              delay: appointmentDateTime.diff(now),
              jobId: `reminder-${id}-${reminderIndex}-exact`,
            },
          );
        }
      }
      // const oneDayBefore = appointmentDateTime.clone().subtract(1, 'minutes');
      // const twoHrBefore = appointmentDateTime.clone().subtract(2, 'minutes');

      const oneDayBefore = appointmentDateTime.clone().subtract(24, 'hours');
      const twoHrBefore = appointmentDateTime.clone().subtract(2, 'hours');

      if (oneDayBefore.isAfter(now)) {
        await this.reminderQueue.add(
          'send-reminder',
          { id, when: '1-day' },
          { delay: oneDayBefore.diff(now), jobId: `reminder-${id}-1-day` },
        );
      }

      if (twoHrBefore.isAfter(now)) {
        await this.reminderQueue.add(
          'send-reminder',
          { id, when: '2-hr' },
          { delay: twoHrBefore.diff(now), jobId: `reminder-${id}-2-hr` },
        );
      }
    } catch (error) {
      console.log('🚀 ~ ReminderService ~ error:', error);
    }
  }

  async removeReminders(id: string) {
    try {
      const jobs = await this.reminderQueue.getJobs(['delayed']);

      const targetJobs = jobs.filter((job) =>
        String(job.id).startsWith(`reminder-${id}-`),
      );

      if (!targetJobs.length) {
        return;
      }

      await Promise.all(
        targetJobs.map(async (job) => {
          await job.remove();
        }),
      );
    } catch (error) {
      console.error(
        `[ReminderService] Error removing reminders for id=${id}:`,
        error,
      );
    }
  }
}
