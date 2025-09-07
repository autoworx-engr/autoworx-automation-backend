import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { ReminderProcessor } from './reminder.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'reminder-queue',
    }),
  ],
  controllers: [ReminderController],
  providers: [ReminderService, ReminderProcessor],
  exports: [ReminderService],
})
export class ReminderModule {}
