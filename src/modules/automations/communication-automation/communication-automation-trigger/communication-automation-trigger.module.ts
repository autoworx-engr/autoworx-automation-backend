import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { PipelineAutomationTriggerModule } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/pipeline-automation-trigger.module';
import { CommunicationAutomationTriggerController } from './communication-automation-trigger.controller';
import { CommunicationAutomationTriggerService } from './communication-automation-trigger.service';
import { CommunicationTimeDelayProcessor } from './processors/communication-time-delay.processor';
import { CommunicationAutomationTriggerRepository } from './repository/communication-automation-trigger.repository';
import { CommunicationAutomationModule } from '../communication-automation-rule/communication-automation.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'communication-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    forwardRef(() => PipelineAutomationTriggerModule),
    forwardRef(() => CommunicationAutomationModule),
  ],
  controllers: [CommunicationAutomationTriggerController],
  providers: [
    CommunicationAutomationTriggerRepository,
    CommunicationAutomationTriggerService,
    CommunicationTimeDelayProcessor,
  ],
  exports: [
    CommunicationAutomationTriggerRepository,
    CommunicationAutomationTriggerService,
  ],
})
export class CommunicationAutomationTriggerModule {}
