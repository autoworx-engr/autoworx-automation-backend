import { Module } from '@nestjs/common';
import { ServiceAutomationTriggerRepository } from './repository/service-automation-trigger.repository';
import { BullModule } from '@nestjs/bull';
import { ServiceTimeDelayProcessor } from './processors/service-time-delay.processor';
import { ServiceAutomationTriggerController } from './controllers/service-automation-trigger.controller';
import { ServiceAutomationTriggerService } from './services/service-automation-trigger.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'service-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [ServiceAutomationTriggerController],
  providers: [
    ServiceAutomationTriggerRepository,
    ServiceAutomationTriggerService,
    ServiceTimeDelayProcessor,
  ],
})
export class ServiceAutomationTriggerModule {}
