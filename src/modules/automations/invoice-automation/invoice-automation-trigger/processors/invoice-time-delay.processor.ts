import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ExecutionStatus } from '@prisma/client';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { MailUtils } from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TimeDelayRuleService } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/services/time-delay-rule.service';
import { InvoiceAutomationTriggerRepository } from '../repository/invoice-automation-trigger.repository';
import { IInvoiceAutomationTrigger } from '../interfaces/invoice-automation-trigger.interface';

@Processor('invoice-time-delay')
export class InvoiceTimeDelayProcessor {
  constructor(
    private readonly invoiceAutomationRepository: InvoiceAutomationTriggerRepository,
    private readonly globalRepository: GlobalRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => TimeDelayRuleService))
    private readonly timeDelayRuleService: TimeDelayRuleService,
  ) {}
  private readonly logger = new Logger(InvoiceTimeDelayProcessor.name);

  @Process('process-invoice-time-delay')
  async processInvoiceTimeDelay(job: Job) {
    const { executionId, ruleId, invoiceId, companyId, type } =
      job.data as IInvoiceAutomationTrigger;

    try {
      const execution =
        await this.globalRepository.findTimeDelayExecution(executionId);

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found, skipping`);
        return { success: false, reason: 'Execution not found' };
      }

      const rule = await this.invoiceAutomationRepository.findRuleById(ruleId);

      if (!rule) {
        this.logger.warn(`Rule ${ruleId} not found, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Rule not found' };
      }

      if (rule.isPaused) {
        this.logger.warn(`Rule ${ruleId} is paused, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Rule is paused' };
      }

      const companyInfo = await this.globalRepository.findCompanyById(
        companyId,
        {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            email: true,
          },
        },
      );

      const invoice = await this.globalRepository.findInvoiceById(
        invoiceId,
        companyId,
        type,
      );

      const serviceItems = invoice.client?.Lead?.Service?.name;

      const placeholdersValue = {
        invoiceLink: `https://autoworx.tech/public-invoice/${invoice.id}`,
        address: invoice.client?.address ? invoice.client?.address : 'N/A',
        client: invoice.client?.firstName + ' ' + invoice.client?.lastName,
        businessName: companyInfo?.name,
        date: invoice.createdAt,
        reviewLink: 'N/A',
        service: serviceItems,
        phone: invoice.client?.mobile || '',
      };
      // send email for column change
      const formattedEmailBody = this.mailUtils.formatBody(
        rule.emailBody || '',
        placeholdersValue,
      );

      const formattedSmsBody = this.mailUtils.formatBody(
        rule.smsBody || '',
        placeholdersValue,
      );

      const attachmentUrls = rule.attachments.map(
        (attachment) => attachment.fileUrl,
      );

      if (
        rule.communicationType === 'EMAIL' ||
        rule.communicationType === 'BOTH'
      ) {
        await this.mailService.sendEmail({
          subject: rule.emailSubject || '',
          clientEmail: invoice.client?.email || '',
          emailBody: formattedEmailBody,
          companyEmail: companyInfo?.email || '',
          companyId: companyId,
          attachments: attachmentUrls,
          clientId: invoice.client?.id!,
        });

        this.logger.log(
          `Email successfully sent to Name:${invoice.client?.firstName + ' ' + invoice.client?.lastName}, Email:${invoice.client?.email} via invoice automation.`,
        );
      }

      if (
        rule.communicationType === 'SMS' ||
        rule.communicationType === 'BOTH'
      ) {
        if (
          companyInfo &&
          invoice.client &&
          invoice.client?.mobile &&
          isValidUSMobile(invoice.client?.mobile)
        ) {
          try {
            if (companyInfo.smsGateway === 'TWILIO') {
              await this.smsService.sendSms({
                companyId: companyInfo?.id,
                clientId: invoice.client?.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            } else if (companyInfo.smsGateway === 'INFOBIP') {
              await this.infobipSms.sendInfobipSms({
                companyId: companyInfo?.id,
                clientId: invoice.client?.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            }
          } catch (error) {
            this.logger.error(`Failed to send SMS: ${error.message}`);
          }

          this.logger.log(
            `SMS successfully sent to Name:${invoice.client?.firstName + ' ' + invoice.client?.lastName}, Mobile:${invoice.client?.mobile} via invoice automation.`,
          );
        }
      }

      await this.globalRepository.updateExecutionStatus(
        executionId,
        ExecutionStatus.COMPLETED,
      );
      this.logger.log('The invoice automation successfully completed!');
    } catch (error) {
      this.logger.error(
        `Failed to process execution ${executionId}: ${error.message} in invoice automation`,
        error.stack,
      );
      await this.globalRepository.updateExecutionStatus(
        executionId,
        ExecutionStatus.FAILED,
      );
      return {
        statusCode: 500,
        reason: 'Execution failed',
        error: error.message,
      };
    }
  }
}
