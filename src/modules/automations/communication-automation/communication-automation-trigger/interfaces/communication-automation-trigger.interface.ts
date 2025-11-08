import {
  CommunicationAutomationRule,
  CommunicationStage,
  TagConditionType,
} from '@prisma/client';

export interface ICommunicationAutomationRule
  extends CommunicationAutomationRule {
  stages: CommunicationStage[];
}
export interface ICommunicationAutomationTrigger {
  executionId: number;
  ruleId: number;
  leadId: number;
  columnId: number;
  companyId: number;
}

export interface IScheduleTimeDelay {
  ruleId: number;
  leadId: number;
  columnId: number;
  companyId: number;
  delayInSeconds: number;
  conditionType?: TagConditionType;
}
