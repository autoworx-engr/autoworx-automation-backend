import { InvoiceType } from '@prisma/client';

export interface IInvoiceAutomationTrigger {
  executionId: number;
  ruleId: number;
  invoiceId: string;
  type: InvoiceType;
  columnId: number;
  companyId: number;
}

export interface IScheduleTimeDelay {
  ruleId: number;
  columnId: number;
  companyId: number;
  invoiceId: string;
  type: InvoiceType;
  delayInSeconds: number;
}
