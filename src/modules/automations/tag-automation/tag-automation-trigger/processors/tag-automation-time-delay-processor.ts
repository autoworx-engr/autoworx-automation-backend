import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Logger } from '@nestjs/common';
import { Attachment, Client, ExecutionStatus, Lead } from '@prisma/client';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import {
  MailUtils,
  TPlaceholder,
} from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TagAutomationTriggerRepository } from '../repository/tag-automation-trigger.repository';
import { TagAutomationRuleWithRelations } from 'src/common/types/tagAutomationRule';
import { TagAutomationTriggerService } from '../services/tag-automation-trigger.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PipelineAutomationTriggerService } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/services/pipeline-automation-trigger.service';
import { ServiceAutomationTriggerService } from 'src/modules/automations/service-automation/service-automation-trigger/services/service-automation-trigger.service';
import { CommunicationAutomationTriggerService } from 'src/modules/automations/communication-automation/communication-automation-trigger/communication-automation-trigger.service';
import { InvoiceAutomationTriggerService } from 'src/modules/automations/invoice-automation/invoice-automation-trigger/services/invoice-automation-trigger.service';

@Processor('tag-time-delay')
export class TagTimeDelayProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly globalRepository: GlobalRepository,
    private readonly tagAutomationRepository: TagAutomationTriggerRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @InjectQueue('tag-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
    private readonly pipelineAutomationTriggerService: PipelineAutomationTriggerService,
    private readonly communicationAutomationTriggerService: CommunicationAutomationTriggerService,
    private readonly serviceMaintenanceAutomationTriggerService: ServiceAutomationTriggerService,
    private readonly invoiceAutomationTriggerService: InvoiceAutomationTriggerService,
  ) {}
  private readonly logger = new Logger(TagTimeDelayProcessor.name);

  private async handlePipelineAutomation({
    companyId,
    tagId,
    rule,
    leadId,
    invoiceId,
  }) {
    if (!tagId || !rule?.tagAutomationPipeline?.targetColumnId) {
      return { success: false, message: 'Invalid pipeline configuration' };
    }

    this.logger.log(
      `Trigger tag automation condition type is post tag and pipeline type ${rule?.pipelineType}`,
    );
    //* INVOICE-BASED pipeline TAG AUTOMATION ---
    if (invoiceId && rule?.pipelineType === 'SHOP') {
      const updatedInvoice = await this.globalRepository.updateEstimateColumn({
        companyId,
        estimateId: invoiceId,
        targetedColumnId: rule?.tagAutomationPipeline?.targetColumnId,
      });

      if (updatedInvoice) {
        await this.tagAutomationTriggerService.update({
          columnId: updatedInvoice.columnId!,
          companyId,
          pipelineType: 'SHOP',
          invoiceId,
          conditionType: 'post_tag',
        });

        await this.serviceMaintenanceAutomationTriggerService.update({
          columnId: updatedInvoice.columnId!,
          companyId,
          estimateId: updatedInvoice?.id,
        });

        await this.invoiceAutomationTriggerService.update({
          columnId: updatedInvoice.columnId!,
          companyId,
          invoiceId: updatedInvoice?.id,
          type: updatedInvoice.type,
        });

        this.logger.log(
          `Pipeline automation (SHOP) executed for invoice ${invoiceId}`,
        );

        return {
          success: true,
          message: 'Pipeline automation triggered successfully for invoice',
          updatedData: updatedInvoice,
        };
      }
    }
    //* LEAD-BASED POST TAG AUTOMATION ---
    if (leadId && rule?.pipelineType === 'SALES') {
      const updatedLead = await this.globalRepository.updatePipelineLeadColumn({
        companyId,
        leadId,
        targetedColumnId: rule?.tagAutomationPipeline?.targetColumnId,
      });

      if (updatedLead) {
        await this.tagAutomationTriggerService.update({
          columnId: updatedLead.columnId!,
          companyId,
          pipelineType: 'SALES',
          leadId,
          conditionType: 'post_tag',
        });

        await this.communicationAutomationTriggerService.update({
          columnId: updatedLead.columnId!,
          companyId,
          leadId,
        });

        await this.pipelineAutomationTriggerService.update({
          leadId: updatedLead.id,
          columnId: updatedLead.columnId!,
          companyId: companyId,
          condition: 'TIME_DELAY',
        });

        this.logger.log(
          `Pipeline automation (SALES) executed for lead ${leadId}`,
        );

        return {
          success: true,
          message: 'Pipeline automation triggered successfully for lead',
          updatedData: updatedLead,
        };
      }
    }

    return { success: false, message: 'Pipeline automation skipped' };
  }

  private async handleCommunicationAutomation({
    companyId,
    rule,
    ruleId,
    executionId,
    leadId,
    invoice,
    invoiceId,
    tagId,
    conditionType,
  }) {
    this.logger.log(
      `Trigger tag automation condition type is communication and pipeline type ${rule?.pipelineType}`,
    );

    if (
      rule?.tagAutomationCommunication?.isSendWeekDays ||
      rule?.tagAutomationCommunication?.isSendOfficeHours
    ) {
      const shouldExecute =
        await this.tagAutomationTriggerService.shouldExecuteTagAutomation(
          ruleId as number,
          new Date(),
        );

      if (!shouldExecute) {
        this.logger.log(
          `Rule ${ruleId} is restricted by time settings (weekdays: ${rule?.tagAutomationCommunication?.isSendWeekDays}, office hours: ${rule?.tagAutomationCommunication?.isSendOfficeHours}). Current time is outside execution window. Rescheduling for next valid time.`,
        );

        try {
          // Get the next valid business day and time
          const nextValidTime =
            await this.tagAutomationTriggerService.getAdjustedExecutionDateForTag(
              ruleId as number,
              new Date(),
              0, // No additional delay
            );

          // Update the execution time
          await this.globalRepository.updateExecutionTime(
            executionId as number,
            nextValidTime,
          );

          // Calculate new delay in milliseconds
          const delayMs = nextValidTime.getTime() - Date.now();

          // Re-queue the job with the new delay
          if (delayMs > 0) {
            const execution =
              await this.globalRepository.findTimeDelayExecution(
                executionId as number,
              );

            if (!execution) {
              throw new Error(`Execution record ${executionId} not found`);
            }

            if (!invoice?.id) {
              await this.timeDelayQueue.add(
                'process-tag-time-delay',
                {
                  executionId,
                  ruleId,
                  columnId: execution.columnId,
                  companyId,
                  leadId,
                  conditionType,
                  tagId,
                  invoiceId,
                },
                {
                  delay: delayMs,
                  jobId: `${executionId}_rescheduled`,
                  removeOnComplete: true,
                },
              );
            } else {
              await this.timeDelayQueue.add(
                'process-tag-time-delay',
                {
                  executionId,
                  ruleId,
                  columnId: execution.columnId,
                  companyId,
                  leadId,
                  conditionType,
                  tagId,
                  invoiceId,
                },
                {
                  delay: delayMs,
                  jobId: `${executionId}_rescheduled`,
                  removeOnComplete: true,
                },
              );
            }

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
            executionId as number,
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

    let lead: any = null;
    if (leadId) {
      lead = (await this.globalRepository.findUniqueLeadById(leadId as number, {
        include: {
          Client: true,
        },
      })) as Lead & { Client: Client[] };
    }

    const vehicleInfo = lead?.vehicleId
      ? await this.globalRepository.findVehicleById(lead?.vehicleId, {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            clientId: true,
          },
        })
      : invoice?.vehicleId
        ? await this.globalRepository.findVehicleById(
            invoice.vehicleId as number,
            {
              select: {
                id: true,
                make: true,
                model: true,
                year: true,
                clientId: true,
              },
            },
          )
        : null;

    const companyInfo = await this.globalRepository.findCompanyById(
      companyId as number,
      {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          email: true,
          smsGateway: true,
          googleReviewLink: true,
        },
      },
    );

    const placeholdersValue: TPlaceholder = {
      contactName: `${lead ? lead?.clientName : invoice?.client?.firstName}`,
      client: `${lead ? lead?.clientName : invoice?.client?.firstName}`,
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
    // send email for column change
    const formattedEmailBody = this.mailUtils.formatBody(
      (rule?.tagAutomationCommunication?.emailBody as string) || '',
      placeholdersValue,
    );
    const formattedEmailSubject = this.mailUtils.formatBody(
      (rule?.tagAutomationCommunication?.subject as string) || '',
      placeholdersValue,
    );

    const formattedSmsBody = this.mailUtils.formatBody(
      (rule?.tagAutomationCommunication?.smsBody as string) || '',
      placeholdersValue,
    );

    const attachmentUrls = rule?.tagAutomationCommunication?.attachments.map(
      (attachment: Attachment) => attachment.fileUrl,
    );

    if (
      rule?.tagAutomationCommunication?.communicationType === 'EMAIL' ||
      rule?.tagAutomationCommunication?.communicationType === 'BOTH'
    ) {
      await this.mailService.sendEmail({
        subject: formattedEmailSubject,
        clientEmail:
          rule.pipelineType === 'SALES'
            ? lead.clientEmail!
            : invoice
              ? invoice.client?.email
              : ' ',
        emailBody: formattedEmailBody,
        companyEmail: companyInfo?.email || '',
        companyId: companyId,
        attachments: attachmentUrls,
        clientId: vehicleInfo?.clientId ?? (lead.clientId || invoice?.clientId),
      });
    }

    if (
      rule?.tagAutomationCommunication?.communicationType === 'SMS' ||
      rule?.tagAutomationCommunication?.communicationType === 'BOTH'
    ) {
      if (
        companyInfo &&
        rule.pipelineType === 'SALES' &&
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

    if (
      rule?.tagAutomationCommunication?.communicationType === 'SMS' ||
      rule?.tagAutomationCommunication?.communicationType === 'BOTH'
    ) {
      if (
        companyInfo &&
        rule.pipelineType === 'SHOP' &&
        invoice?.client &&
        invoice?.client.mobile &&
        isValidUSMobile(invoice?.client.mobile as string)
      ) {
        try {
          if (companyInfo.smsGateway === 'TWILIO') {
            await this.smsService.sendSms({
              companyId: companyId,
              clientId: invoice.clientId! ?? invoice.clientId,
              message: formattedSmsBody,
              attachments: attachmentUrls,
            });
          } else if (companyInfo.smsGateway === 'INFOBIP') {
            await this.infobipSms.sendInfobipSms({
              companyId: companyId,
              clientId: invoice.clientId! ?? invoice.clientId,
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
      executionId as number,
      ExecutionStatus.COMPLETED,
    );
  }

  async handlePostTagAutomation({
    companyId,
    rule,
    leadId,
    invoiceId,
    invoice,
    lead,
  }: {
    companyId: number;
    rule: any;
    leadId?: number;
    invoiceId?: string;
    invoice?: any;
    lead?: any;
  }) {
    this.logger.log(
      `Trigger tag automation condition type is post tag and pipeline type ${rule?.pipelineType}`,
    );
    try {
      //* INVOICE-BASED POST TAG AUTOMATION ---
      if (invoiceId && rule?.pipelineType === 'SHOP') {
        // Prevent duplicate one-time trigger
        if (rule?.ruleType === 'one_time' && invoice?.isTriggered) {
          this.logger.log(
            `The post-tag automation already triggered for invoice ID: ${invoice?.id}`,
          );
          return {
            success: false,
            reason: 'Already triggered on this invoice',
          };
        }

        // Collect existing and rule tags
        // const invoiceTags = invoice?.tags || [];
        const ruleTags = rule?.tag || [];

        const existing = await this.prisma.invoiceTags.findMany({
          where: { invoiceId },
          select: { tagId: true },
        });
        const existingTagIds = existing.map((t) => t.tagId);

        const ruleTagIds = ruleTags.map((t: { id: number }) => t.id);

        // Find missing tags
        const missingTagIds = ruleTagIds.filter(
          (id: number) => !existingTagIds.includes(id),
        );

        if (missingTagIds.length > 0 && invoiceId) {
          const updatedLead =
            await this.globalRepository.updatePipelineInvoiceTags({
              invoiceId,
              companyId,
              tags: missingTagIds,
            });

          if (updatedLead) {
            this.logger.log(
              `Post-tag automation created new tags on invoice ID: ${invoice?.id}`,
            );
            return {
              success: true,
              message: 'Tags added successfully to invoice',
              addedTagIds: missingTagIds,
            };
          }
        }

        return { success: false, message: 'No new tags to add for invoice' };
      }

      //* LEAD-BASED POST TAG AUTOMATION ---
      if (leadId && rule?.pipelineType === 'SALES') {
        // Prevent duplicate one-time trigger
        if (rule?.ruleType === 'one_time' && lead?.isTriggered) {
          this.logger.log(
            `The post-tag automation already triggered for lead ID: ${lead?.id}`,
          );
          return { success: false, reason: 'Already triggered on this lead' };
        }

        // Collect existing lead tags and rule tags
        const leadTags = lead?.leadTags || [];
        const ruleTags = rule?.tag || [];

        const existingTagIds = leadTags.map((t: { tagId: number }) => t.tagId);
        const ruleTagIds = ruleTags.map((t: { id: number }) => t.id);

        // Find missing lead tags
        const missingTagIds = ruleTagIds.filter(
          (id: number) => !existingTagIds.includes(id),
        );

        if (missingTagIds.length > 0 && leadId) {
          const updatedLead =
            await this.globalRepository.updatePipelineLeadTags({
              leadId,
              companyId,
              tags: missingTagIds,
            });

          if (updatedLead) {
            this.logger.log(
              `Post-tag automation created new tags on lead ID: ${lead?.id}`,
            );
            return {
              success: true,
              message: 'Tags added successfully to lead',
              addedTagIds: missingTagIds,
            };
          }
        }

        return { success: false, message: 'No new tags to add for lead' };
      }
    } catch (error) {
      this.logger.error(
        `Failed to execute post-tag automation: ${error.message} in tag automation`,
      );
      throw error;
    }
  }

  @Process('process-tag-time-delay')
  async processTagTimeDelay(job: Job) {
    const {
      executionId,
      ruleId,
      companyId,
      conditionType,
      leadId,
      tagId,
      invoiceId,
    } = job.data;

    this.logger.log(
      `🎯 Processing tag delay job: ${JSON.stringify(job.data)} `,
    );

    try {
      const execution = await this.globalRepository.findTimeDelayExecution(
        executionId as number,
      );

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found, skipping`);
        return { success: false, reason: 'Execution not found' };
      }

      const rule: TagAutomationRuleWithRelations =
        await this.tagAutomationRepository.findRuleById(ruleId as number);
      if (!rule) {
        this.logger.warn(`Rule ${ruleId} not found, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId as number,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Rule not found' };
      }

      if (rule.isPaused) {
        this.logger.warn(`Rule ${ruleId} is paused, skipping execution`);
        await this.globalRepository.updateExecutionStatus(
          executionId as number,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Rule is paused' };
      }

      let lead;
      let invoice;

      if (invoiceId) {
        invoice = await this.globalRepository.findInvoiceById(
          invoiceId as string,
          companyId as number,
          'Invoice',
        );
      } else {
        lead = await this.globalRepository.findLeadById(
          leadId as number,
          companyId as number,
        );
      }

      if (
        conditionType === 'pipeline' &&
        tagId &&
        rule?.tagAutomationPipeline?.targetColumnId
      ) {
        return await this.handlePipelineAutomation({
          companyId,
          tagId,
          rule,
          leadId,
          invoiceId,
        });
      } else if (
        conditionType === 'communication' &&
        tagId &&
        rule?.tagAutomationCommunication
      ) {
        await this.handleCommunicationAutomation({
          companyId,
          rule,
          ruleId,
          executionId,
          leadId,
          invoiceId,
          invoice,
          tagId,
          conditionType: 'communication',
        });
      } else if (
        conditionType === 'post_tag' &&
        !tagId &&
        rule?.PostTagAutomationColumn
      ) {
        const postTagResult = await this.handlePostTagAutomation({
          companyId,
          rule,
          leadId,
          invoiceId,
          invoice,
          lead,
        });

        return postTagResult;
      }

      return {
        statusCode: 200,
        reason: 'Tag automation successfully triggered!',
      };
    } catch (error) {
      this.logger.error(
        `Failed to process execution ${executionId}: ${error.message} in tag automation`,
        error.stack,
      );
      await this.globalRepository.updateExecutionStatus(
        executionId as number,
        ExecutionStatus.FAILED,
      );
      return {
        statusCode: 500,
        reason: 'Execution failed in tag automation!',
        error: error.message,
      };
    }
  }
}
