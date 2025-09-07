import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  InventoryNotificationAction,
  InventoryCondition,
} from '@prisma/client';
import {
  NotificationData,
  NotificationRecipient,
} from '../interfaces/inventory-trigger.interface';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class InventoryNotificationService {
  private readonly logger = new Logger(InventoryNotificationService.name);

  constructor(
    @InjectQueue('inventory-notifications')
    private readonly notificationQueue: Queue,
    private readonly httpService: HttpService, // <-- Inject here
  ) {}

  /**
   * Send inventory notifications based on action type using Bull queue
   */
  async sendNotifications(notificationData: NotificationData): Promise<void> {
    const { action, recipients } = notificationData;

    this.logger.log(
      `Queuing inventory notifications for rule: ${notificationData.ruleTitle}`,
    );

    const message = this.generateMessage(notificationData);
    const emailSubject = this.generateEmailSubject(notificationData.condition);

    switch (action) {
      case InventoryNotificationAction.EMAIL:
        await this.queueEmailNotifications(
          recipients,
          message,
          emailSubject,
          notificationData,
        );
        break;
      case InventoryNotificationAction.SMS: {
        const pdfUrl = await this.generateAndUploadPdf(notificationData);
        const smsMessage = `You are running out of stocks. View full details: ${pdfUrl}`;
        await this.queueSmsNotifications(
          recipients,
          smsMessage,
          notificationData,
        );
        break;
      }
      case InventoryNotificationAction.BOTH: {
        const pdfUrl = await this.generateAndUploadPdf(notificationData);
        const smsMessage = `You are running out of stocks. View full details: ${pdfUrl}`;
        console.log(smsMessage);
        
        await Promise.all([
          this.queueEmailNotifications(
            recipients,
            message,
            emailSubject,
            notificationData,
          ),
          this.queueSmsNotifications(recipients, smsMessage, notificationData),
        ]);
        break;
      }
      default:
        this.logger.warn(`Unknown notification action: ${action}`);
    }
  }

  /**
   * Queue email notifications for all recipients
   */
  private async queueEmailNotifications(
    recipients: NotificationRecipient[],
    message: string,
    subject: string,
    notificationData: NotificationData,
  ): Promise<void> {
    const emailRecipients = recipients.filter((recipient) => recipient.email);

    if (emailRecipients.length === 0) {
      this.logger.warn('No email recipients found for inventory notification');
      return;
    }

    this.logger.log(`Queuing emails for ${emailRecipients.length} recipients`);

    // Queue email jobs for each recipient
    const emailJobs = emailRecipients.map((recipient) => ({
      type: 'email' as const,
      recipient,
      notificationData,
      message,
      subject,
    }));

    for (const jobData of emailJobs) {
      await this.notificationQueue.add('send-notification', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    }

    this.logger.log(`Queued ${emailJobs.length} email notification jobs`);
  }

  /**
   * Queue SMS notifications for all recipients
   */
  private async queueSmsNotifications(
    recipients: NotificationRecipient[],
    message: string,
    notificationData: NotificationData,
  ): Promise<void> {
    const smsRecipients = recipients.filter((recipient) => recipient.phone);

    if (smsRecipients.length === 0) {
      this.logger.warn('No SMS recipients found for inventory notification');
      return;
    }

    this.logger.log(`Queuing SMS for ${smsRecipients.length} recipients`);

    // Queue SMS jobs for each recipient
    const smsJobs = smsRecipients.map((recipient) => ({
      type: 'sms' as const,
      recipient,
      notificationData,
      message,
    }));

    for (const jobData of smsJobs) {
      await this.notificationQueue.add('send-notification', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    }

    this.logger.log(`Queued ${smsJobs.length} SMS notification jobs`);
  }

  /**
   * Generate notification message based on rule condition
   */
  private generateMessage(notificationData: NotificationData): string {
    let message = 'You are running out of stocks for below products:\n\n';

    // Add out of stock products only if condition allows
    if (
      (notificationData.condition === 'OUT_OF_STOCK' ||
        notificationData.condition === 'BOTH') &&
      notificationData.outOfStockProducts.length > 0
    ) {
      message += 'OUT OF STOCK:\n';
      let outOfStockCount = 1;
      for (const product of notificationData.outOfStockProducts) {
        message += `${outOfStockCount}. ${product.name} → 0 ${product.unit}\n`;
        outOfStockCount++;
      }
      message += '\n';
    }

    // Add low stock products only if condition allows
    if (
      (notificationData.condition === 'LOW_STOCK' ||
        notificationData.condition === 'BOTH') &&
      notificationData.lowStockProducts.length > 0
    ) {
      message += 'LOW STOCK:\n';
      let lowStockCount = 1;
      for (const product of notificationData.lowStockProducts) {
        message += `${lowStockCount}. ${product.name} → ${product.currentQuantity} ${product.unit}\n`;
        lowStockCount++;
      }
      message += '\n';
    }

    message +=
      'Please reorder these items to maintain adequate inventory levels.';
    return message;
  }

  /**
   * Generate email subject based on condition
   */
  private generateEmailSubject(condition: InventoryCondition): string {
    switch (condition) {
      case InventoryCondition.LOW_STOCK:
        return 'Low Stock Alert - Inventory Management';
      case InventoryCondition.OUT_OF_STOCK:
        return 'Out of Stock Alert - Inventory Management';
      case InventoryCondition.BOTH:
        return 'Inventory Alert - Low & Out of Stock Items';
      default:
        return 'Inventory Alert';
    }
  }

  private async generateAndUploadPdf(
    notificationData: NotificationData,
  ): Promise<string> {
    const tempFilePath = path.join(__dirname, `${uuidv4()}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Inventory Stock Alert', { align: 'center', underline: true });
    doc.moveDown(1);
    doc
      .fontSize(13)
      .font('Helvetica')
      .text('You are running out of stocks for the below products:', {
        align: 'left',
      });
    doc.moveDown(1);

    if (
      (notificationData.condition === 'OUT_OF_STOCK' ||
        notificationData.condition === 'BOTH') &&
      notificationData.outOfStockProducts.length > 0
    ) {
      doc
        .fontSize(15)
        .font('Helvetica-Bold')
        .text('OUT OF STOCK:', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      let outOfStockCount = 1;
      for (const product of notificationData.outOfStockProducts) {
        doc.text(`${outOfStockCount}. ${product.name}: 0 ${product.unit}`, {
          indent: 20,
        });
        outOfStockCount++;
      }
      doc.moveDown(1);
    }

    if (
      (notificationData.condition === 'LOW_STOCK' ||
        notificationData.condition === 'BOTH') &&
      notificationData.lowStockProducts.length > 0
    ) {
      doc
        .fontSize(15)
        .font('Helvetica-Bold')
        .text('LOW STOCK:', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      let lowStockCount = 1;
      for (const product of notificationData.lowStockProducts) {
        doc.text(
          `${lowStockCount}. ${product.name}: ${product.currentQuantity} ${product.unit}`,
          { indent: 20 },
        );
        lowStockCount++;
      }
      doc.moveDown(1);
    }

    doc
      .fontSize(13)
      .font('Helvetica-Oblique')
      .text(
        'Please reorder these items to maintain adequate inventory levels.',
        { align: 'left' },
      );

    doc.end();

    await new Promise<void>((resolve) => stream.on('finish', () => resolve()));

    // Upload to S3 via frontend API using @nestjs/axios
    const FRONTEND_URL = process.env.FRONTEND_URL;
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath));
    const headers = formData.getHeaders();

    const response = await lastValueFrom(
      this.httpService.post(`${FRONTEND_URL}/api/upload`, formData, {
        headers,
      }),
    );

    fs.unlinkSync(tempFilePath);

    return response.data?.data[0]; // The S3 link
  }
}
