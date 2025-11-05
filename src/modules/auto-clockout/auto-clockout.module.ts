import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AutoClockOutController } from './auto-clockout.controller';
import { AutoClockOutProcessor } from './auto-clockout.processor';
import { AutoClockOutService } from './auto-clockout.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'auto-clockout-queue',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [AutoClockOutController],
  providers: [AutoClockOutService, AutoClockOutProcessor],
  exports: [AutoClockOutService],
})
export class AutoClockOutModule {}
