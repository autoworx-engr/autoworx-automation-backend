// src/queues/reminder.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ReminderService } from './reminder.service';

@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Post('schedule')
  async schedule(
    @Body()
    body: {
      id: string;
      date: string;
      time: string;
      timezone: string;
      when?: 'exact';
      reminderIndex?: number;
    },
  ) {
    await this.reminderService.scheduleReminders(
      body.id,
      body.date,
      body.time,
      body.timezone,
      body.when,
      body.reminderIndex,
    );
    return { status: 'scheduled' };
  }

  @Post('edit-schedule')
  async editSchedule(
    @Body()
    body: {
      id: string;
      date: string;
      time: string;
      timezone: string;
      when?: 'exact';
      reminderIndex?: number;
    },
  ) {
    // Delete old reminders
    await this.reminderService.removeReminders(body.id);

    // Schedule new reminders
    await this.reminderService.scheduleReminders(
      body.id,
      body.date,
      body.time,
      body.timezone,
      body.when,
      body.reminderIndex,
    );

    return { status: 'rescheduled' };
  }

  @Post('delete')
  async delete(@Body() body: { id: string; count: number }) {
    await this.reminderService.removeReminders(body.id);
    return { status: 'deleted' };
  }
}
