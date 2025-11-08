import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { PipelineAutomationTriggerModule } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/pipeline-automation-trigger.module';
import { TagAutomationTriggerRepository } from './repository/tag-automation-trigger.repository';
import { TagAutomationTriggerService } from './services/tag-automation-trigger.service';
import { TagTimeDelayProcessor } from './processors/tag-automation-time-delay-processor';
import { TagAutomationTriggerController } from './controllers/tag-automation-trigger.controller';

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
  ],
  exports: [TagAutomationTriggerRepository, TagAutomationTriggerService],
})
export class InvoiceAutomationTriggerModule {}
