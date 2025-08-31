import {
  AutomationAttachment,
  ServiceMaintenanceAutomationRule,
  ServiceMaintenanceStage,
} from '@prisma/client';

export interface IServiceAutomationRule
  extends ServiceMaintenanceAutomationRule {
  serviceMaintenanceStage: ServiceMaintenanceStage[];
  attachments: AutomationAttachment[];
}
export interface IServiceAutomationTrigger {
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
  isSendWeekDays: boolean;
}
