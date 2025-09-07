import { Module } from '@nestjs/common';
import { PipelineAutomationTriggerModule } from './pipeline-automation-trigger/pipeline-automation-trigger.module';
import { PipelineAutomationRuleModule } from './pipeline-automation-rule/pipeline-automation-rule.module';

@Module({
  providers: [],
  imports: [PipelineAutomationTriggerModule, PipelineAutomationRuleModule],
})
export class PipelineAutomationModule {}
