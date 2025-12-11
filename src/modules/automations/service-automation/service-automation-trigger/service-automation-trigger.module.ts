import { forwardRef, Module } from '@nestjs/common';
import { ServiceAutomationTriggerRepository } from './repository/service-automation-trigger.repository';
import { BullModule } from '@nestjs/bull';
import { ServiceTimeDelayProcessor } from './processors/service-time-delay.processor';
import { ServiceAutomationTriggerController } from './controllers/service-automation-trigger.controller';
import { ServiceAutomationTriggerService } from './services/service-automation-trigger.service';
import { TagAutomationTriggerModule } from '../../tag-automation/tag-automation-trigger/tag-automation-trigger.module';

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
    forwardRef(() => TagAutomationTriggerModule),
  ],
  controllers: [ServiceAutomationTriggerController],
  providers: [
    ServiceAutomationTriggerRepository,
    ServiceAutomationTriggerService,
    ServiceTimeDelayProcessor,
  ],
  exports: [ServiceAutomationTriggerService],
})
export class ServiceAutomationTriggerModule {}
