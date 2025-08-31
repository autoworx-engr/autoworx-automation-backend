export interface IInventoryEmailProps {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  companyId: number;
  fromEmail?: string;
}

export interface IInventorySmsProps {
  to: string;
  message: string;
  companyId: number;
}
