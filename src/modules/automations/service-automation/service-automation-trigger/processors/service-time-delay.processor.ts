import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ServiceAutomationTriggerRepository } from '../repository/service-automation-trigger.repository';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Logger } from '@nestjs/common';
import { ExecutionStatus } from '@prisma/client';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import {
  MailUtils,
  TPlaceholder,
} from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { IServiceAutomationTrigger } from '../interfaces/service-automation-trigger.interface';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TagAutomationTriggerService } from 'src/modules/automations/tag-automation/tag-automation-trigger/services/tag-automation-trigger.service';

@Processor('service-time-delay')
export class ServiceTimeDelayProcessor {
  constructor(
    private readonly serviceAutomationRepository: ServiceAutomationTriggerRepository,
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
    private readonly globalRepository: GlobalRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
  ) {}
  private readonly logger = new Logger(ServiceTimeDelayProcessor.name);

  @Process('process-service-time-delay')
  async processServiceTimeDelay(job: Job) {
    const { executionId, ruleId, estimateId, companyId } =
      job.data as IServiceAutomationTrigger;

    try {
      const execution =
        await this.globalRepository.findTimeDelayExecution(executionId);

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found, skipping`);
        return;
      }

      const rule = await this.serviceAutomationRepository.findRuleById(ruleId);
      if (!rule) {
        this.logger.warn(`Rule ${ruleId} not found, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return;
      }

      if (rule.isPaused) {
        this.logger.warn(`Rule ${ruleId} is paused, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return;
      }

      const estimate = await this.globalRepository.findEstimateById(
        estimateId,
        companyId,
      );

      if (!estimate || !estimate.client) {
        this.logger.warn(`Estimate or client data missing, skipping`);
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.FAILED,
        );
        return;
      }

      if (estimate.columnId != execution.columnId) {
        this.logger.log(
          `Estimate ${estimateId} moved from column ${execution.columnId} to ${estimate.columnId}`,
        );
        await this.globalRepository.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return;
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
            smsGateway: true,
          },
        },
      );

      const vehicleInfo = estimate?.client?.Lead?.vehicleId
        ? await this.globalRepository.findVehicleById(
            estimate?.client?.Lead?.vehicleId,
            {
              select: { id: true, make: true, model: true, year: true },
            },
          )
        : null;

      const placeholdersValue: TPlaceholder = {
        contactName: `${estimate.client.firstName} ${estimate.client.lastName}`,
        client: `${estimate.client.firstName} ${estimate.client.lastName}`,
        interest: 'N/A',
        vehicle: vehicleInfo
          ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year}`
          : '',
        businessName: companyInfo?.name || '',
        businessPhone: companyInfo?.phone || '',
        businessAddress: companyInfo?.address || '',
        videoDirection: 'N/A',
        googleMapLink: 'N/A',
        googleReviewLink: companyInfo?.googleReviewLink || 'N/A',
      };

      const formattedEmailBody = this.mailUtils.formatBody(
        rule.emailBody || '',
        placeholdersValue,
      );
      const formattedEmailSubject = this.mailUtils.formatBody(
        rule.emailSubject || '',
        placeholdersValue,
      );

      const formattedSmsBody = this.mailUtils.formatBody(
        rule.smsBody || '',
        placeholdersValue,
      );

      const attachmentUrls = rule.attachments.map(
        (attachment) => attachment.fileUrl,
      );

      if (rule.emailBody && rule.emailSubject && estimate.client.email) {
        await this.mailService.sendEmail({
          subject: formattedEmailSubject,
          clientEmail: estimate.client.email || '',
          emailBody: formattedEmailBody,
          companyEmail: companyInfo?.email || '',
          companyId: companyId,
          attachments: attachmentUrls,
          clientId: estimate.client.id,
        });

        this.logger.log(
          `Email successfully sent to ${estimate.client?.firstName} ${estimate.client?.lastName} (${estimate.client?.email}) via service automation.`,
        );
      }

      if (rule.smsBody) {
        if (
          companyInfo &&
          estimate.client &&
          estimate.client.mobile &&
          isValidUSMobile(estimate.client.mobile)
        ) {
          try {
            if (companyInfo.smsGateway === 'TWILIO') {
              await this.smsService.sendSms({
                companyId: companyInfo?.id,
                clientId: estimate.client.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            } else if (companyInfo.smsGateway === 'INFOBIP') {
              await this.infobipSms.sendInfobipSms({
                companyId: companyInfo?.id,
                clientId: estimate.client.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            }
          } catch (error) {
            this.logger.error(`Failed to send SMS: ${error.message}`);
          }
        }
        this.logger.log(
          `SMS successfully sent to Name:${estimate.client?.firstName + ' ' + estimate.client?.lastName}, Mobile:${estimate.client?.mobile} via service automation.`,
        );
      }
      if (rule.targetColumnId) {
        const updatedEstimate =
          await this.globalRepository.updateEstimateColumn({
            companyId,
            estimateId,
            targetedColumnId: rule.targetColumnId,
          });

        if (updatedEstimate) {
          await this.tagAutomationTriggerService.update({
            columnId: updatedEstimate.columnId!,
            companyId,
            pipelineType: 'SHOP',
            invoiceId: estimateId,
            conditionType: 'post_tag',
          });
        }

        this.logger.log(
          `Estimate ${estimateId} moved to column ${rule.targetColumnId} successfully`,
        );
      }

      await this.globalRepository.updateExecutionStatus(
        executionId,
        ExecutionStatus.COMPLETED,
      );

      this.logger.log(
        'The service maintenance automation successfully completed!',
      );
    } catch (error) {
      this.logger.error(
        `Failed to process execution ${executionId}: ${error.message} in service maintenance automation!`,
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
