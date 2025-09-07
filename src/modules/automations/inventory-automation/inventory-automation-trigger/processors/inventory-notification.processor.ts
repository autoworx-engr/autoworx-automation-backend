import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InventoryMessagingService } from '../services/inventory-messaging.service';
import { NotificationData } from '../interfaces/inventory-trigger.interface';
import {
  IInventoryEmailProps,
  IInventorySmsProps,
} from '../interfaces/inventory-email.interface';

interface NotificationJobData {
  type: 'email' | 'sms';
  recipient: {
    userId: number;
    name: string;
    email?: string;
    phone?: string;
  };
  notificationData: NotificationData;
  message: string;
  subject?: string;
}

@Processor('inventory-notifications')
export class InventoryNotificationProcessor {
  private readonly logger = new Logger(InventoryNotificationProcessor.name);

  constructor(private readonly messagingService: InventoryMessagingService) {}

  @Process('send-notification')
  async processNotification(job: Job<NotificationJobData>) {
    const { type, recipient, notificationData, message, subject } = job.data;

    try {
      this.logger.log(
        `Processing ${type} notification for user ${recipient.userId} (${recipient.name})`,
      );

      if (type === 'email' && recipient.email) {
        await this.sendEmailNotification(
          recipient,
          message,
          subject!,
          notificationData.companyId,
        );
      } else if (type === 'sms' && recipient.phone) {
        await this.sendSmsNotification(
          recipient,
          message,
          notificationData.companyId,
        );
      } else {
        this.logger.warn(
          `Cannot send ${type} notification to ${recipient.name}: missing ${type === 'email' ? 'email' : 'phone'} address`,
        );
        return;
      }

      this.logger.log(
        `Successfully sent ${type} notification to ${recipient.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${type} notification to ${recipient.name}:`,
        error,
      );
      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async sendEmailNotification(
    recipient: NotificationJobData['recipient'],
    message: string,
    subject: string,
    companyId: number,
  ): Promise<void> {
    const emailProps: IInventoryEmailProps = {
      to: recipient.email!,
      subject,
      textBody: message,
      htmlBody: message.replace(/\n/g, '<br>'),
      companyId,
    };

    await this.messagingService.sendInventoryEmail(emailProps);
  }

  private async sendSmsNotification(
    recipient: NotificationJobData['recipient'],
    message: string,
    companyId: number,
  ): Promise<void> {
    const smsProps: IInventorySmsProps = {
      to: recipient.phone!,
      message,
      companyId,
    };

    await this.messagingService.sendInventorySms(smsProps, recipient.userId);
  }
}
