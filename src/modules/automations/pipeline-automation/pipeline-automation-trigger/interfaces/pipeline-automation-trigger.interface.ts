import { PipelineAutomationRule, PipelineStage } from '@prisma/client';

export interface IPipelineAutomationRule extends PipelineAutomationRule {
  stages: PipelineStage[];
}
