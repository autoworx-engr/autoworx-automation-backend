export interface ISendInfobipSms {
  companyId: number;
  clientId: number;
  message: string;
  attachments?: string[];
}
