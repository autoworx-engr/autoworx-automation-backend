import { Injectable, Logger } from '@nestjs/common';
import { ISendEmailProps } from './interfaces/sendEmail.interface';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as FormData from 'form-data';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationTrackService } from '../sendSms/services/conversation-track.service';

@Injectable()
export class MailService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly conversationTrackService: ConversationTrackService,
  ) {}
  logger = new Logger(MailService.name);
  pump = promisify(pipeline);

  // sendEmail function to send email using Infobip Email API v3
  async sendEmail({
    companyEmail,
    clientEmail,
    emailBody,
    lastEmailMessageId,
    companyId,
    attachments,
    subject,
    companyName,
    clientId,
  }: ISendEmailProps): Promise<any> {
    try {
      console.log('🚀 ~ MailService ~ Sending Email : ', {
        companyEmail,
        clientEmail,
        companyId,
      });

      if (!clientEmail) {
        console.log('Email Not found', clientEmail);
        return;
      }

      // Get Infobip configuration
      const infobipBaseUrl = this.configService.get('infobip.baseUrl'); // e.g. "rr7w1k.api.infobip.com"
      const infobipApiKey = this.configService.get('infobip.apiKey');
      const infobipDomain = this.configService.get('infobip.domain'); // your verified domain

      if (!infobipBaseUrl || !infobipApiKey || !infobipDomain) {
        throw new Error('Infobip credentials not configured');
      }

      const company = await this.prismaService.company.findUnique({
        where: { id: +companyId },
        select: { name: true },
      });

      const form = new FormData();

      // Use verified sender address with display name
      form.append(
        'from',
        `${company?.name || companyEmail} <mail@${infobipDomain}>`,
      );
      form.append('to', clientEmail);
      form.append(
        'subject',
        subject || `New message from ${companyName || companyEmail}`,
      );
      form.append('text', emailBody || '');

      // If the emailBody contains HTML tags (like <br>), also send as HTML
      if (emailBody && emailBody.includes('<br>')) {
        form.append('html', emailBody);
      }

      // Set reply-to for routing replies back to your system
      form.append('replyTo', `${companyId}@ib79097.${infobipDomain}`);

      // Add custom headers as JSON (Infobip v3 format)
      const customHeaders: Record<string, string | string[]> = {};

      // Add threading headers if this is a reply
      if (lastEmailMessageId) {
        customHeaders['In-Reply-To'] = lastEmailMessageId;
        customHeaders['References'] = lastEmailMessageId;
      }

      form.append('headers', JSON.stringify(customHeaders));

      // Handle multiple files
      const uploadDir = path.join(__dirname, 'public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const images = attachments || [];
      const filePaths: string[] = [];

      for (const url of images) {
        try {
          const response = await this.httpService.axiosRef.get(url, {
            responseType: 'stream',
          });
          const fileName = path.basename(new URL(url).pathname);
          const filePath = path.join(uploadDir, fileName);
          const writer = fs.createWriteStream(filePath);

          filePaths.push(filePath);

          await new Promise((resolve, reject) => {
            response.data.pipe(writer);
            writer.on('finish', () => resolve(''));
            writer.on('error', reject);
          });

          // Infobip: multiple "attachment" parts allowed
          form.append('attachment', fs.createReadStream(filePath), fileName);
        } catch (error) {
          this.logger.warn(
            `Failed to download attachment from ${url}: ${error.message}`,
          );
        }
      }

      // Send the email via Infobip Email API v3
      const sendMailRes = await firstValueFrom(
        this.httpService
          .post(`https://${infobipBaseUrl}/email/3/send`, form, {
            headers: {
              Accept: 'application/json',
              Authorization: `App ${infobipApiKey}`,
              // NOTE: Don't set Content-Type; FormData sets boundary automatically
              ...form.getHeaders(),
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error('Infobip API Error:', error.response?.data);
              throw new Error(
                `Failed to send email via Infobip: ${error.message || 'Unknown error'}`,
              );
            }),
          ),
      );

      // Cleanup temp files
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              this.logger.warn(
                `Failed to delete file ${filePath}: ${err.message}`,
              );
            }
          });
        }
      }

      this.logger.log('Email sent successfully via Infobip');

      // Infobip returns: { messages: [{ messageId, status, to, ... }] }
      // Extract messageId for future threading
      const messageId = sendMailRes.data?.messages?.[0]?.messageId;

      // Save email record to database if clientId is provided
      if (clientId) {
        await this.prismaService.mailgunEmail.create({
          data: {
            subject:
              subject || `New message from ${companyName || companyEmail}`,
            text: emailBody || '',
            emailBy: 'Company',
            companyId: +companyId,
            clientId: clientId,
            messageId: messageId || '',
          },
        });

        // Update client email conversation track
        await this.conversationTrackService.updateNewEmailChatTrack({
          clientId,
          emailLastMessage: emailBody || '',
          lastMessageBy: 'Company',
          lastEmailBy: 'Company',
        });
      }

      return {
        ...sendMailRes.data,
        messageId, // Include messageId at root level for easier access
      };
    } catch (error: any) {
      console.error('sendEmail error', error);
      this.logger.error('Failed to send email:', error.message);
      throw error;
    }
  }

  webStreamToNodeStream(webStream: ReadableStream<Uint8Array>): Readable {
    const reader = webStream.getReader();

    return new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null); // End of stream
        } else {
          this.push(Buffer.from(value));
        }
      },
    });
  }
}
