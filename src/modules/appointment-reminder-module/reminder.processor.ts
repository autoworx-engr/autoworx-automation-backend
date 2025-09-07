// src/queues/reminder.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import * as moment from 'moment-timezone';

@Processor('reminder-queue')
@Injectable()
export class ReminderProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly sms: SmsService,
  ) {}

  @Process('send-reminder')
  async handleReminder(job: Job<{ id: string; when: '1-day' | '2-hr' }>) {
    const {
      id: appointmentId,
      // when
    } = job.data;

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
          },
        },
        vehicle: true,
      },
    });

    const reminderTemplate = {
      subject: 'Reminder: Your <VEHICLE> Service Appointment',
      message: `Reminder: <CLIENT>, your <BUSINESS_NAME> appt is on <DATE>. If you’re not able to make it, text here to reschedule.`,
    };

    if (!appointment?.client) {
      console.log('🚀 ~ ReminderProcessor ~ No client found');
      return;
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
      .replace('<BUSINESS_NAME>', appointment.company?.name || '');

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
      await this.sms.sendSms({
        companyId: appointment.companyId,
        clientId: appointment.clientId!,
        message: message ?? '',
        attachments: [],
      });
    } catch (error) {
      console.error('Failed to send SMS:', error.message);
    }
  }
}
