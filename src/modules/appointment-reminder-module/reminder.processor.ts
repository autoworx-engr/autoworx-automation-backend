// src/queues/reminder.processor.ts
import { HttpService } from '@nestjs/axios';
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as moment from 'moment-timezone';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';

import { catchError, map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { User } from '@prisma/client';

@Processor('reminder-queue')
@Injectable()
export class ReminderProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly sms: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  @Process('send-reminder')
  async handleReminder(
    job: Job<{ id: string; when: '1-day' | '2-hr' | 'exact' }>,
  ) {
    const { id: appointmentId, when } = job.data;

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: +appointmentId },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            name: true,
            email: true,
            timezone: true,
            address: true,
            phone: true,
            smsGateway: true,
          },
        },
        vehicle: true,
      },
    });

    if (!appointment || !appointment?.client) {
      console.log('🚀 ~ ReminderProcessor ~ No appointment found');
      return;
    }

    const reminderTemplate = {
      subject: 'Reminder: Your <VEHICLE> Service Appointment',
      message: `Reminder: <CLIENT>, your <BUSINESS_NAME> appt is on <DATE>. If you’re not able to make it, text here to reschedule.`,
    };

    if (when === 'exact') {
      if (!appointment.reminderEmailTemplateId) {
        console.log(
          '🚀 ~ ReminderProcessor ~ No reminder email template set for appointment',
        );
        return;
      }
      const reminderTemplateMessage = await this.prisma.emailTemplate.findFirst(
        {
          where: {
            id: appointment.reminderEmailTemplateId,
          },
        },
      );

      if (reminderTemplateMessage) {
        if (reminderTemplateMessage.subject) {
          reminderTemplate.subject = reminderTemplateMessage.subject;
        }
        if (reminderTemplateMessage.message) {
          reminderTemplate.message = reminderTemplateMessage.message;
        }
      }
    }

    const tz =
      appointment.company?.timezone || appointment.timezone || 'Etc/UTC';

    const appointmentDateTime = moment.tz(
      `${appointment.date?.toISOString().split('T')[0]}T${appointment.startTime}`,
      tz,
    );

    const subject = reminderTemplate.subject
      ?.replace(
        '<VEHICLE>',
        appointment.vehicle
          ? (appointment.vehicle.year || '') +
              ' ' +
              (appointment.vehicle.make || '') +
              ' ' +
              (appointment.vehicle.model || '') +
              ' ' +
              (appointment.vehicle.other || '')
          : '',
      )
      ?.replace(
        '<CLIENT>',
        appointment.client.firstName || appointment.client.lastName || '',
      )
      ?.replace('<DATE>', appointmentDateTime.format('ddd, MMM D, h:mm A'));

    const message = reminderTemplate.message
      ?.replace(
        '<VEHICLE>',
        appointment.vehicle
          ? (appointment.vehicle.year || '') +
              ' ' +
              (appointment.vehicle.make || '') +
              ' ' +
              (appointment.vehicle.model || '') +
              ' ' +
              (appointment.vehicle.other || '')
          : '',
      )
      ?.replace(
        '<CLIENT>',
        appointment.client.firstName || appointment.client.lastName || '',
      )
      ?.replace('<DATE>', appointmentDateTime.format('ddd, MMM D, h:mm A'))
      .replace('<BUSINESS_NAME>', appointment.company?.name || '')
      ?.replace('<ADDRESS>', appointment.company?.address ?? '')
      .replace('<PHONE>', appointment.company?.phone ?? '');

    try {
      await this.mailService.sendEmail({
        companyEmail: appointment.company.email!,
        clientEmail: appointment.client.email!,
        emailBody: message ?? '',
        lastEmailMessageId: undefined,
        companyId: appointment.companyId,
        attachments: [],
        subject,
        clientId: appointment.clientId!,
      });
      console.log('🚀 ~ ReminderProcessor ~ handleReminder ~ Email sent');
    } catch (err) {
      console.error('Failed to send reminder email:', err.message);
    }

    try {
      if (appointment.company?.smsGateway === 'TWILIO') {
        await this.sms.sendSms({
          companyId: appointment.companyId,
          clientId: appointment.clientId!,
          message: message ?? '',
          attachments: [],
        });
        console.log('🚀 ~ ReminderProcessor ~ handleReminder ~ SMS sent');
      } else if (appointment.company?.smsGateway === 'INFOBIP') {
        await this.infobipSms.sendInfobipSms({
          companyId: appointment.companyId,
          clientId: appointment.clientId!,
          message: message ?? '',
          attachments: [],
        });
        console.log(
          '🚀 ~ ReminderProcessor ~ handleReminder ~ Infobip SMS sent',
        );
      }

      try {
        const findCompanyUser = await this.prisma.user.findMany({
          where: {
            companyId: appointment.companyId,
            OR: [
              {
                employeeType: 'Admin',
              },
              {
                employeeType: 'Manager',
              },
              {
                employeeType: 'Sales',
              },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        });

        await Promise.all(
          findCompanyUser.map(async (user: User) => {
            const requestBody = {
              userId: user.id,
              userName: user.firstName + ' ' + user.lastName,
              userPhoneNo: user.phone,
              userEmail: user.email,
              companyId: appointment.companyId,
              title: 'Appointment Reminder',
              description: `Your appointment with ${appointment?.client?.firstName} ${appointment?.client?.lastName} is scheduled for ${appointmentDateTime.format('ddd, MMM D, h:mm A')}.`,
              iconType: 'task',
              // redirectUrl: string;
            };
            await firstValueFrom(
              this.httpService
                .post(
                  `${this.configService.get<string>('frontendUrl')!}/api/send-notification`,
                  requestBody,
                )
                .pipe(
                  map((response) => response),
                  catchError((error: any) => {
                    if (error.response) {
                      this.logger.error(
                        `Failed to send notification - Status: ${error.response.success}`,
                        error.response.message,
                      );
                    } else {
                      this.logger.error(
                        'Failed to send notification',
                        error.message,
                      );
                    }
                    throw new Error('Failed to send notification');
                  }),
                ),
            );
          }),
        );
        console.log(
          '🚀 ~ ReminderProcessor ~ handleReminder ~ Notifications sent to company users',
        );
      } catch (error) {
        this.logger.error('Failed to send notification:', error.message);
      }
    } catch (error) {
      console.error('Failed to send SMS:', error.message);
    }
  }
}
