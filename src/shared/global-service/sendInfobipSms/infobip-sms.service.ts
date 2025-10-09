import { Injectable, NotFoundException } from '@nestjs/common';
import { InfobipSmsRepository } from './repositories/sms.repository';
import { ISendInfobipSms } from './interfaces/sms.interface';
import { isValidUSMobile } from '../utils/isValidUSMobile';
import { PrismaService } from 'src/prisma/prisma.service';
import { InfobipConversationTrackService } from './services/conversation-track.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InfobipSmsService {
  constructor(
    private readonly infobipSmsRepository: InfobipSmsRepository,
    private readonly prisma: PrismaService,
    private readonly conversationTrackService: InfobipConversationTrackService,
    private readonly configService: ConfigService,
  ) {}

  async sendInfobipSms({
    companyId,
    clientId,
    message,
    attachments = [],
  }: ISendInfobipSms) {
    console.log(
      '🚀 ~ InfobipSmsService Processing ~ sendInfobipSms ~ companyId:',
      companyId,
    );
    if (!companyId) {
      throw new Error('Company ID is required');
    }

    const infobipConfig =
      await this.infobipSmsRepository.getInfobipConfigById(companyId);

    if (!infobipConfig) {
      throw new Error('Infobip configuration not found');
    }

    const client =
      clientId &&
      (await this.infobipSmsRepository.getClientById(clientId, {
        select: {
          id: true,
          mobile: true,
          companyId: true,
          Lead: {
            select: {
              id: true,
              columnId: true,
            },
          },
        },
      }));

    if (!client || !client.mobile) {
      throw new Error('Client not found');
    }

    const to = this.normalizeUSPhoneNumber(client?.mobile);

    if (!isValidUSMobile(to || '')) {
      throw new Error('Invalid US mobile number format');
    }

    if (infobipConfig.phoneNumber && to && clientId) {
      // Normalize phone numbers for MMS compatibility
      const normalizedSender = this.normalizeUSPhoneNumber(
        String(infobipConfig.phoneNumber),
      );
      const normalizedRecipient = this.normalizeUSPhoneNumber(to);

      // Send SMS/MMS via Infobip API
      const infobipApiKey = this.configService.get<string>('INFOBIP_API_KEY');
      const infobipBaseUrl =
        'https://' + this.configService.get<string>('INFOBIP_BASE_URL');

      let infobipResponse;

      // Helper function to determine content type
      const getContentTypeFromUrl = (url: string, fileName: string): string => {
        const extension =
          fileName.split('.').pop()?.toLowerCase() ||
          url.split('.').pop()?.toLowerCase();

        switch (extension) {
          case 'jpg':
          case 'jpeg':
            return 'image/jpeg';
          case 'png':
            return 'image/png';
          case 'gif':
            return 'image/gif';
          case 'pdf':
            return 'application/pdf';
          case 'mp4':
            return 'video/mp4';
          case 'mov':
            return 'video/quicktime';
          case 'mp3':
            return 'audio/mpeg';
          case 'wav':
            return 'audio/wav';
          default:
            return 'application/octet-stream';
        }
      };

      // Check if we have attachments to determine if this should be MMS
      if (attachments && attachments.length > 0) {
        // Prepare media segments using direct links (no upload needed)
        const mediaSegments = attachments.map((url) => {
          // Extract file name from URL
          const fileName = url.split('/').pop() || 'attachment';
          const contentType = getContentTypeFromUrl(url, fileName);
          const contentId = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

          return {
            type: 'LINK',
            contentId: contentId,
            contentType: contentType,
            contentUrl: url,
          };
        });

        // Send MMS with direct links using v2 API format
        const messageSegments: any[] = [];

        // Add text segment if message exists
        if (message && message.trim()) {
          messageSegments.push({
            type: 'TEXT',
            text: message,
          });
        }

        // Add media segments
        messageSegments.push(...mediaSegments);

        const mmsPayload = {
          messages: [
            {
              sender: normalizedSender || infobipConfig.phoneNumber,
              destinations: [{ to: normalizedRecipient || to }],
              content: {
                messageSegments: messageSegments,
              },
            },
          ],
        };

        console.log('MMS Payload:', JSON.stringify(mmsPayload, null, 2));

        infobipResponse = await fetch(`${infobipBaseUrl}/mms/2/messages`, {
          method: 'POST',
          headers: {
            Authorization: `App ${infobipApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(mmsPayload),
        });
      } else {
        // Send SMS without attachments
        const smsPayload = {
          messages: [
            {
              sender: normalizedSender || infobipConfig.phoneNumber,
              destinations: [{ to: normalizedRecipient || to }],
              content: {
                text: message,
              },
            },
          ],
        };

        infobipResponse = await fetch(`${infobipBaseUrl}/sms/3/messages`, {
          method: 'POST',
          headers: {
            Authorization: `App ${infobipApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(smsPayload),
        });
      }

      if (!infobipResponse.ok) {
        const errorData = await infobipResponse.json();
        console.error('Infobip API error:', errorData);
        throw new Error(
          `Infobip API error: ${infobipResponse.status} - ${JSON.stringify(errorData)}`,
        );
      }

      const infobipResult = await infobipResponse.json();
      console.log('Infobip API response:', infobipResult);

      // Save SMS to database
      const dbMessage = await this.prisma.clientSMS.create({
        data: {
          from: infobipConfig.phoneNumber,
          to,
          message: message ?? '',
          sentBy: 'Company',
          isRead: true,
          clientId,
          companyId: infobipConfig.companyId,
        },
      });

      // Save attachments if any
      for (const url of attachments) {
        // Extract file name from URL
        const fileName = url.split('/').pop() || 'attachment';
        await this.prisma.clientSmsAttachments.create({
          data: {
            name: fileName,
            url: url,
            clientSMSId: dbMessage.id,
          },
        });
      }

      // Update conversation track
      await this.conversationTrackService.updateNewSMSChatTrack({
        clientId,
        smsLastMessage: message ?? '',
        lastMessageBy: 'Company',
      });

      // Retrieve the complete message with attachments
      const data = await this.infobipSmsRepository.getSmsWithAttachments(
        dbMessage.id,
      );

      return {
        success: true,
        message: 'SMS sent successfully via Infobip',
        sender: infobipConfig.phoneNumber,
        recipient: to,
        messageBody: message,
        data,
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
