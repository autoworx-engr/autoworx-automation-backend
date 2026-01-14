import { Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { ReminderProcessor } from './reminder.processor';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'reminder-queue',
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ReminderController],
  providers: [ReminderService, ReminderProcessor, Logger],
  exports: [ReminderService],
})
export class ReminderModule {}
