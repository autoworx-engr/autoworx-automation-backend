import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { CommunicationAutomationTriggerRepository } from '../repository/communication-automation-trigger.repository';
import {
  MailUtils,
  TPlaceholder,
} from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { TimeDelayRuleService } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/services/time-delay-rule.service';
import { CommunicationAutomationService } from '../../communication-automation-rule/communication-automation.service';
import { CommunicationAutomationTriggerService } from '../communication-automation-trigger.service';
import { ICommunicationAutomationTrigger } from '../interfaces/communication-automation-trigger.interface';
import { Client, ExecutionStatus, Lead } from '@prisma/client';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TagAutomationTriggerService } from 'src/modules/automations/tag-automation/tag-automation-trigger/services/tag-automation-trigger.service';

@Processor('communication-time-delay')
export class CommunicationTimeDelayProcessor {
  constructor(
    private readonly communicationAutomationRepository: CommunicationAutomationTriggerRepository,
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
    private readonly globalRepository: GlobalRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @InjectQueue('communication-time-delay')
    private readonly timeDelayQueue: Queue,
    @Inject(forwardRef(() => TimeDelayRuleService))
    private readonly timeDelayRuleService: TimeDelayRuleService,
    @Inject(forwardRef(() => CommunicationAutomationService))
    private readonly communicationAutomationService: CommunicationAutomationService,
    @Inject(forwardRef(() => CommunicationAutomationTriggerService))
    private readonly communicationAutomationTriggerService: CommunicationAutomationTriggerService,
  ) {}
  private readonly logger = new Logger(CommunicationTimeDelayProcessor.name);

  @Process('process-communication-time-delay')
  async processCommunicationTimeDelay(job: Job) {
    const { executionId, ruleId, leadId, companyId } =
      job.data as ICommunicationAutomationTrigger;

    // Get execution details
    const execution =
      await this.globalRepository.findTimeDelayExecution(executionId);

    if (!execution) {
      this.logger.warn(`Execution ${executionId} not found, skipping`);
      return { success: false, reason: 'Execution not found' };
    }

    const rule =
      await this.communicationAutomationRepository.findRuleById(ruleId);
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

    // Check if we should execute based on both weekend and office hours settings
    // Only check if either isSendWeekDays or isSendOfficeHours is enabled
    if (rule.isSendWeekDays || rule.isSendOfficeHours) {
      const shouldExecute =
        await this.communicationAutomationTriggerService.shouldExecuteAutomation(
          ruleId,
          new Date(),
        );

      if (!shouldExecute) {
        this.logger.log(
          `Rule ${ruleId} is restricted by time settings (weekdays: ${rule.isSendWeekDays}, office hours: ${rule.isSendOfficeHours}). Current time is outside execution window. Rescheduling for next valid time.`,
        );

        try {
          // Get the next valid business day and time
          const nextValidTime =
            await this.communicationAutomationTriggerService.getAdjustedExecutionDate(
              ruleId,
              new Date(),
              0, // No additional delay
            );

          // Update the execution time
          await this.globalRepository.updateExecutionTime(
            executionId,
            nextValidTime,
          );

          // Calculate new delay in milliseconds
          const delayMs = nextValidTime.getTime() - Date.now();

          // Re-queue the job with the new delay
          if (delayMs > 0) {
            const execution =
              await this.globalRepository.findTimeDelayExecution(executionId);

            if (!execution) {
              throw new Error(`Execution record ${executionId} not found`);
            }

            await this.timeDelayQueue.add(
              'process-communication-time-delay',
              {
                executionId,
                ruleId,
                leadId,
                columnId: execution.columnId, // Use the columnId from the execution
                companyId,
              },
              {
                delay: delayMs,
                jobId: `${executionId}_rescheduled`,
                removeOnComplete: true,
              },
            );

            this.logger.log(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Rescheduled job for execution at ${nextValidTime}`,
            );
          }

          return {
            success: false,
            reason:
              'Rule set to execute only on weekdays during active hours. Rescheduled for next valid time.',
          };
        } catch (error) {
          this.logger.error(`Failed to reschedule job: ${error.message}`);
          await this.globalRepository.updateExecutionStatus(
            executionId,
            ExecutionStatus.CANCELLED,
          );
          return {
            success: false,
            reason: 'Failed to reschedule for next valid time',
          };
        }
      }
    }

    // Check if lead still exists and is in the right column
    const lead = (await this.globalRepository.findLeadById(leadId, companyId, {
      include: {
        Client: true,
      },
    })) as Lead & { Client: Client[] };

    // For rules with targetColumnId, we need to ensure the lead is still in the original column
    // For rules without targetColumnId, we can execute them even if the column has changed
    if (rule.targetColumnId && lead.columnId !== execution.columnId) {
      this.logger.warn(
        `Rule has targetColumnId: Lead ${leadId} is no longer in the original column ${execution.columnId}, current column: ${lead.columnId}. Cancelling execution.`,
      );
      await this.globalRepository.updateExecutionStatus(
        executionId,
        ExecutionStatus.CANCELLED,
      );
      return {
        success: false,
        reason: 'Lead column changed and rule has targetColumnId',
      };
    }

    const vehicleInfo = lead.vehicleId
      ? await this.globalRepository.findVehicleById(lead.vehicleId, {
          select: { id: true, make: true, model: true, year: true },
        })
      : null;

    const companyInfo = await this.globalRepository.findCompanyById(companyId, {
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        email: true,
        smsGateway: true,
      },
    });

    const placeholdersValue: TPlaceholder = {
      contactName: `${lead?.clientName}`,
      client: `${lead?.clientName}`,
      vehicle: vehicleInfo
        ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year}`
        : '',
      businessName: companyInfo?.name || '',
      businessPhone: companyInfo?.phone || '',
      businessAddress: companyInfo?.address || '',
      videoDirection: 'N/A',
      googleMapLink: 'N/A',
    };
    // send email for column change
    const formattedEmailBody = this.mailUtils.formatBody(
      rule.emailBody || '',
      placeholdersValue,
    );
    const formattedEmailSubject = this.mailUtils.formatBody(
      rule.subject || '',
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
        subject: formattedEmailSubject,
        clientEmail: lead.clientEmail || '',
        emailBody: formattedEmailBody,
        companyEmail: companyInfo?.email || '',
        companyId: companyId,
        attachments: attachmentUrls,
        clientId: lead.Client?.[0]?.id ?? lead.clientId,
      });
    }

    if (rule.communicationType === 'SMS' || rule.communicationType === 'BOTH') {
      if (
        companyInfo &&
        lead.Client.length > 0 &&
        lead.Client?.[0]?.mobile &&
        isValidUSMobile(lead.Client?.[0]?.mobile)
      ) {
        try {
          if (companyInfo.smsGateway === 'TWILIO') {
            await this.smsService.sendSms({
              companyId: companyId,
              clientId: lead.Client?.[0]?.id ?? lead.clientId,
              message: formattedSmsBody,
              attachments: attachmentUrls,
            });
          } else if (companyInfo.smsGateway === 'INFOBIP') {
            await this.infobipSms.sendInfobipSms({
              companyId: companyId,
              clientId: lead.Client?.[0]?.id ?? lead.clientId,
              message: formattedSmsBody,
              attachments: attachmentUrls,
            });
          }
        } catch (error) {
          this.logger.error(`Failed to send SMS: ${error.message}`);
        }
      }
    }

    // Update execution status to COMPLETED
    await this.globalRepository.updateExecutionStatus(
      executionId,
      ExecutionStatus.COMPLETED,
    );

    // update pipeline lead column
    if (rule.targetColumnId) {
      const updatedLead = await this.globalRepository.updatePipelineLeadColumn({
        companyId,
        leadId,
        targetedColumnId: rule.targetColumnId,
      });

      if (updatedLead) {
        await this.tagAutomationTriggerService.update({
          columnId: updatedLead.columnId!,
          companyId,
          pipelineType: 'SALES',
          leadId,
          conditionType: 'post_tag',
        });
      }

      this.logger.log(
        `Lead ${leadId} moved to column ${rule.targetColumnId} successfully`,
      );

      // Check for time delay rules in the updated column (similar to pipeline automation)
      await this.timeDelayRuleService.checkAndExecuteTimeDelayInUpdatedColumn(
        companyId,
        leadId,
        rule.targetColumnId,
      );

      // Check and execute communication automation rules in the target column
      await this.communicationAutomationTriggerService.checkAndExecuteCommunicationRulesInTargetColumn(
        companyId,
        leadId,
        rule.targetColumnId,
      );
    }

    return {
      statusCode: 200,
      reason: 'lead column updated successfully',
    };
  }
}
