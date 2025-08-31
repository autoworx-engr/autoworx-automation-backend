import {
  ServiceMaintenanceAutomationRule,
  ServiceMaintenanceStage,
} from '@prisma/client';

export interface IServiceAutomationRule
  extends ServiceMaintenanceAutomationRule {
  stages: ServiceMaintenanceStage[];
}
export interface IServiceAutomationTrigger {
  executionId: number;
  ruleId: number;
  estimateId: string;
  columnId: number;
  companyId: number;
}

export interface IScheduleTimeDelay {
  ruleId: number;
  estimateId: string;
  columnId: number;
  companyId: number;
  delayInSeconds: number;
}
