export interface ISendSms {
  companyId: number;
  clientId: number;
  message: string;
  attachments?: string[];
}
