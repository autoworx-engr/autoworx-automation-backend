import { Module } from '@nestjs/common';
import { PipelineAutomationRuleController } from './controllers/pipeline-automation-rule.controller';
import { PipelineAutomationRuleRepository } from './repositories/pipeline-automation-rule.repository';
import { PipelineAutomationRuleService } from './services/pipeline-automation-rule.service';

@Module({
  controllers: [PipelineAutomationRuleController],
  providers: [PipelineAutomationRuleService, PipelineAutomationRuleRepository],
})
export class PipelineAutomationRuleModule {}
