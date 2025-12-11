import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { PipelineAutomationTriggerController } from './controllers/pipeline-automation-trigger.controller';
import { TimeDelayProcessor } from './processors/time-delay.processor';
import { PipelineAutomationTriggerRepository } from './repository/pipeline-automation-trigger.repository';
import { CleanupService } from './services/cleanup.service';
import { PipelineAutomationTriggerService } from './services/pipeline-automation-trigger.service';
import { TimeDelayService } from './services/time-delay.service';
import { TimeDelayRuleService } from './services/time-delay-rule.service';
import { CommunicationAutomationRuleService } from './services/communication-automation-rule.service';
import { CommunicationAutomationTriggerModule } from '../../communication-automation/communication-automation-trigger/communication-automation-trigger.module';
import { TagAutomationTriggerModule } from '../../tag-automation/tag-automation-trigger/tag-automation-trigger.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pipeline-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    forwardRef(() => CommunicationAutomationTriggerModule),
    TagAutomationTriggerModule,
  ],
  controllers: [PipelineAutomationTriggerController],
  providers: [
    PipelineAutomationTriggerService,
    PipelineAutomationTriggerRepository,
    TimeDelayProcessor,
    TimeDelayService,
    TimeDelayRuleService,
    CommunicationAutomationRuleService,
    CleanupService,
  ],
  exports: [
    TimeDelayRuleService,
    PipelineAutomationTriggerRepository,
    TimeDelayService,
    PipelineAutomationTriggerService,
  ],
})
export class PipelineAutomationTriggerModule {}
