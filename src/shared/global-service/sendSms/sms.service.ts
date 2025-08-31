import { Injectable, NotFoundException } from '@nestjs/common';
import { SmsRepository } from './repositories/sms.repository';
import { ISendSms } from './interfaces/sms.interface';
import { Twilio } from 'twilio';
import { isValidUSMobile } from '../utils/isValidUSMobile';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationTrackService } from './services/conversation-track.service';

@Injectable()
export class SmsService {
  constructor(
    private readonly smsRepository: SmsRepository,
    private readonly prisma: PrismaService,
    private readonly conversationTrackService: ConversationTrackService,
  ) {}

  async sendSms({ companyId, clientId, message, attachments }: ISendSms) {
    console.log('🚀 ~ SmsService Processing ~ sendSms ~ companyId:', companyId);
    if (!companyId) {
      throw new Error('Company ID is required');
    }
    const twilioCredentials =
      await this.smsRepository.getTwilioCredentialsById(companyId);

    if (!twilioCredentials) {
      throw new Error('Twilio credentials not found');
    }

    const { accountSid, phoneNumber, apiKeySid, apiKeySecret } =
      twilioCredentials || {};

    const twilio = new Twilio(apiKeySid, apiKeySecret, {
      accountSid,
    });

    const client =
      clientId &&
      (await this.smsRepository.getClientById(clientId, {
        select: {
          id: true,
          mobile: true,
        },
      }));

    if (!client || !client.mobile) {
      throw new Error('Client not found');
    }

    const to = this.normalizeUSPhoneNumber(client?.mobile);

    if (!isValidUSMobile(to || '')) {
      throw new Error('Invalid US mobile number format');
    }

    if (phoneNumber && to && clientId) {
      await twilio.messages.create({
        body: message ?? '',
        from: phoneNumber,
        to,
        mediaUrl: attachments,
      });

      await this.prisma.clientSMS.create({
        data: {
          from: twilioCredentials.phoneNumber,
          to,
          message: message ?? '',
          sentBy: 'Company',
          isRead: true,
          clientId,
          companyId: twilioCredentials.companyId,
        },
      });

      // Update client SMS conversation track
      await this.conversationTrackService.updateNewSMSChatTrack({
        clientId,
        smsLastMessage: message ?? '',
        lastMessageBy: 'Company',
      });

      return {
        message: 'SMS sent successfully',
        sender: phoneNumber,
        recipient: to,
        messageBody: message,
      };
    } else {
      throw new NotFoundException(
        'Phone number or client ID not found. Please check the provided information.',
      );
    }
  }

  normalizeUSPhoneNumber(phoneNumber: string): string | null {
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
