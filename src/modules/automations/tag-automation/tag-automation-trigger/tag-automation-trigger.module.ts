import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { PipelineAutomationTriggerModule } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/pipeline-automation-trigger.module';
import { TagAutomationTriggerRepository } from './repository/tag-automation-trigger.repository';
import { TagAutomationTriggerService } from './services/tag-automation-trigger.service';
import { TagTimeDelayProcessor } from './processors/tag-automation-time-delay-processor';
import { TagAutomationTriggerController } from './controllers/tag-automation-trigger.controller';
import { CommunicationAutomationTriggerRepository } from '../../communication-automation/communication-automation-trigger/repository/communication-automation-trigger.repository';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tag-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    forwardRef(() => PipelineAutomationTriggerModule),
  ],
  controllers: [TagAutomationTriggerController],
  providers: [
    TagAutomationTriggerRepository,
    TagAutomationTriggerService,
    TagTimeDelayProcessor,
    CommunicationAutomationTriggerRepository,
    GlobalRepository,
  ],
  exports: [TagAutomationTriggerRepository, TagAutomationTriggerService],
})
export class TagAutomationTriggerModule {}
