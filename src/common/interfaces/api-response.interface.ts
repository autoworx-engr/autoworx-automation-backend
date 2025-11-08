export interface IApiResponse<T> {
  status: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
  path: string;
}

export interface IPaginatedApiResponse<T> extends IApiResponse<T> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type ITimeExecutionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ITimeExecutionCreate {
  pipelineRuleId?: number | null;
  communicationRuleId?: number | null;
  serviceMaintenanceRuleId?: number | null;
  invoiceAutomationRuleId?: number | null;
  tagAutomationRuleId?: number | null;
  leadId?: number | null;
  estimateId?: string | null;
  columnId: number;
  executeAt: Date;
}
