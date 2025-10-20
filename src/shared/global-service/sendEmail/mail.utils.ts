import { Injectable } from '@nestjs/common';

export type TPlaceholder = {
  contactName?: string;
  contactEmail?: string;
  vehicle?: string;
  businessName?: string;
  businessPhone?: string;
  businessAddress?: string;
  googleMapLink?: string;
  invoiceLink?: string;
  address?: string;
  client?: string;
  phone?: string;
  service?: string;
  date?: string | Date;
  reviewLink?: string;
  contact?: string;
  interest?: string;
  videoDirection?: string;
};

@Injectable()
export class MailUtils {
  formatBody(body: string, placeholdersValue?: TPlaceholder): string {
    const placeholderMap = {
      CONTACT_NAME: placeholdersValue?.contactName?.split(' ')[0] || '',
      CONTACT_EMAIL: placeholdersValue?.contactEmail || '',
      VEHICLE: placeholdersValue?.vehicle || '',
      BUSINESS_NAME: placeholdersValue?.businessName || '',
      BUSINESS_PHONE: placeholdersValue?.businessPhone || '',
      BUSINESS_ADDRESS: placeholdersValue?.businessAddress || '',
      GOOGLE_MAP_LINK: placeholdersValue?.googleMapLink || '',
      INVOICE_LINK: placeholdersValue?.invoiceLink + ' ',
      ADDRESS: placeholdersValue?.address,
      CLIENT: placeholdersValue?.client,
      DATE: placeholdersValue?.date,
      REVIEW_LINK: placeholdersValue?.reviewLink,
      SERVICE: placeholdersValue?.service,
      PHONE: placeholdersValue?.phone,
      CONTACT: placeholdersValue?.contact,
      INTEREST: placeholdersValue?.interest,
      VIDEO_DIRECTIONS: placeholdersValue?.videoDirection,
    };

    // Replace placeholders with empty string if they exist
    const output = body.replace(/[\[\{<](\w+)[\]\}>]/g, (_, key) => {
      return (placeholderMap[key] as string) || '';
    });
    return output;
  }
}
