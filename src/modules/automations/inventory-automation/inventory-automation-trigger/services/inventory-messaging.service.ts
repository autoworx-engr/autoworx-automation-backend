import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../../../../shared/global-service/sendEmail/mail.service';
import { SmsRepository } from '../../../../../shared/global-service/sendSms/repositories/sms.repository';
import {
  IInventoryEmailProps,
  IInventorySmsProps,
} from '../interfaces/inventory-email.interface';
import { Twilio } from 'twilio';
import { isValidUSMobile } from '../../../../../shared/global-service/utils/isValidUSMobile';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InventoryMessagingService {
  private readonly logger = new Logger(InventoryMessagingService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly smsRepository: SmsRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send inventory alert email using the global mail service
   */
  async sendInventoryEmail(emailProps: IInventoryEmailProps): Promise<void> {
    try {
      // For inventory alerts, we'll use a default system email as sender
      const companyEmail = emailProps.fromEmail || 'noreply@autoworx.com';

      // The global mail service uses 'text' field for the email body
      // We'll use the HTML body if available, otherwise fall back to text
      const emailBody = emailProps.htmlBody || emailProps.textBody;

      await this.mailService.sendEmail({
        companyEmail,
        clientEmail: emailProps.to,
        emailBody,
        subject: emailProps.subject,
        companyId: emailProps.companyId,
        attachments: [], // No attachments for inventory alerts
      });

      this.logger.log(`Inventory email sent successfully to ${emailProps.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send inventory email to ${emailProps.to}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Send inventory alert SMS using Twilio directly for internal notifications
   * This bypasses the client-focused SMS service and sends directly to team members
   */
  async sendInventorySms(
    smsProps: IInventorySmsProps,
    userId: number,
  ): Promise<void> {
    try {
      const company = await this.prisma.company.findFirst({
        where: { id: smsProps.companyId },
        select: { smsGateway: true },
      });

      if (company?.smsGateway === 'TWILIO') {
        const twilioCredentials =
          await this.smsRepository.getTwilioCredentialsById(smsProps.companyId);

        if (!twilioCredentials) {
          throw new Error(
            `Twilio credentials not found for company ID: ${smsProps.companyId}`,
          );
        }

        const { accountSid, phoneNumber, apiKeySid, apiKeySecret } =
          twilioCredentials;

        if (!accountSid || !apiKeySid || !apiKeySecret) {
          throw new Error('Incomplete Twilio credentials');
        }

        // Initialize Twilio client
        const twilio = new Twilio(apiKeySid, apiKeySecret, {
          accountSid,
        });

        // Normalize phone number
        const normalizedPhone = this.normalizeUSPhoneNumber(smsProps.to);

        if (!normalizedPhone || !isValidUSMobile(normalizedPhone)) {
          throw new Error(`Invalid US mobile number format: ${smsProps.to}`);
        }

        // Send SMS directly via Twilio
        await twilio.messages.create({
          body: smsProps.message,
          from: phoneNumber,
          to: normalizedPhone,
        });
      } else if (company?.smsGateway === 'INFOBIP') {
        const infobipConfig = await this.prisma.infobipConfig.findFirst({
          where: { companyId: smsProps.companyId },
        });

        if (!infobipConfig) {
          throw new Error('Infobip configuration not found');
        }

        const infobipApiKey = this.configService.get<string>('INFOBIP_API_KEY');
        const infobipBaseUrl =
          'https://' + this.configService.get<string>('INFOBIP_BASE_URL');

        const normalizedPhone = this.normalizeUSPhoneNumber(smsProps.to);

        // Send SMS without attachments
        const smsPayload = {
          messages: [
            {
              sender: infobipConfig.phoneNumber,
              destinations: [{ to: normalizedPhone }],
              content: {
                text: smsProps.message,
              },
            },
          ],
        };

        await fetch(`${infobipBaseUrl}/sms/3/messages`, {
          method: 'POST',
          headers: {
            Authorization: `App ${infobipApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(smsPayload),
        });
      }

      this.logger.log(`Inventory SMS sent successfully to ${smsProps.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send inventory SMS to ${smsProps.to}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Normalize US phone number to +1XXXXXXXXXX format
   */
  private normalizeUSPhoneNumber(phoneNumber: string): string | null {
    if (!phoneNumber) return null;

    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');

    // Normalize to +1XXXXXXXXXX format
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else {
      return phoneNumber;
    }
  }
}
