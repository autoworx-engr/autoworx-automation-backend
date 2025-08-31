export interface ISendEmailProps {
  companyEmail: string;
  clientEmail: string;
  emailBody: string;
  lastEmailMessageId?: string;
  companyId: string | number;
  attachments?: string[];
  subject?: string;
  companyName?: string;
  clientId?: number;
}
