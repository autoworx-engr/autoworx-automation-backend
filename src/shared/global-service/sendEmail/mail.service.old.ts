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

@Injectable()
export class MailService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}
  logger = new Logger(MailService.name);
  pump = promisify(pipeline);

  // sendEmail function to send email using Mailgun API
  async sendEmail({
    companyEmail,
    clientEmail,
    emailBody,
    lastEmailMessageId,
    companyId,
    attachments,
    subject,
  }: ISendEmailProps): Promise<any> {
    try {
      if (!clientEmail) {
        console.log('Email Not found', clientEmail);
        return;
      }

      const form = new FormData();
      form.append('from', `${companyEmail} <${companyEmail}>`);
      form.append('to', clientEmail);
      form.append('subject', subject || '');
      form.append('text', emailBody || '');
      form.append('h:Reply-To', `${companyId}@${process.env.MAILGUN_DOMAIN}`);

      // Add In-Reply-To and References headers if this is a reply
      if (lastEmailMessageId) {
        form.append('h:In-Reply-To', lastEmailMessageId);
        form.append('h:References', lastEmailMessageId);
      }

      // Add DKIM and SPF indicators
      form.append('o:dkim', 'yes');
      form.append('o:tag', 'outbound');

      // Add tracking parameters
      form.append('o:tracking', 'yes');
      form.append('o:tracking-clicks', 'yes');
      form.append('o:tracking-opens', 'yes');
      // Logic to send email

      // Handle multiple files
      const uploadDir = path.join(__dirname, 'public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const images = attachments || [];

      const filePaths: string[] = [];

      for (const url of images) {
        const response = await this.httpService.axiosRef.get(url, {
          responseType: 'stream',
        });
        const fileName = path.basename(new URL(url).pathname); // extract file name from URL
        const filePath = path.join(uploadDir, fileName);
        const writer = fs.createWriteStream(filePath);
        console.log({ image: response.data });
        filePaths.push(filePath);
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on('finish', () => resolve(''));
          writer.on('error', reject);
        });
        form.append('attachment', fs.createReadStream(filePath), fileName);
      }

      // Delete saved attachment files after appending to form

      // Send the email via Mailgun API
      // Use axios to send the form-data, which handles multipart headers automatically
      console.log('Is sendMail response?');
      const sendMailRes = await firstValueFrom(
        this.httpService
          .post(
            `https://api.mailgun.net/v3/${this.configService.get('mailgun.domain')}/messages`,
            form,
            {
              headers: {
                Authorization:
                  'Basic ' +
                  Buffer.from(
                    `${this.configService.get('mailgun.username')}:${this.configService.get('mailgun.api_key')}`,
                  ).toString('base64'),
              },
            },
          )
          .pipe(
            catchError((error: AxiosError) => {
              throw new Error(
                `Failed to send email: ${error.message || 'Unknown error'}`,
              );
            }),
          ),
      );
      console.log('sendMailRes: ', sendMailRes);
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

      this.logger.log('Email send successfully');
      return sendMailRes.data;
    } catch (error: any) {
      console.error('sendEmail error', error);
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
