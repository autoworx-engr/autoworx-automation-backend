import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Logger } from '@nestjs/common';
import {
  Client,
  ExecutionStatus,
  InvoiceTags,
  Lead,
  LeadTags,
} from '@prisma/client';
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

@Processor('tag-time-delay')
export class TagTimeDelayProcessor {
  constructor(
    private readonly globalRepository: GlobalRepository,
    private readonly tagAutomationRepository: TagAutomationTriggerRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @InjectQueue('tag-time-delay')
    private readonly timeDelayQueue: Queue,
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
  ) {}
  private readonly logger = new Logger(TagTimeDelayProcessor.name);

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
          invoiceId,
          companyId,
          'Invoice',
        );
      } else {
        lead = await this.globalRepository.findLeadById(leadId, companyId);
      }

      if (
        conditionType === 'pipeline' &&
        tagId &&
        rule?.tagAutomationPipeline?.targetColumnId
      ) {
        if (invoiceId && rule?.pipelineType === 'SHOP') {
          const updateInvoiceColumnId =
            await this.globalRepository.updateEstimateColumn({
              companyId,
              estimateId: invoiceId,
              targetedColumnId: rule?.tagAutomationPipeline?.targetColumnId,
            });

          if (updateInvoiceColumnId) {
            this.logger.log(
              `The tag automation condition pipeline with shop successfully, invoice id ${invoiceId}`,
            );
          }
        }
        if (leadId && rule?.pipelineType === 'SALES') {
          const updateLeadColumnId =
            await this.globalRepository.updatePipelineLeadColumn({
              companyId,
              leadId,
              targetedColumnId: rule?.tagAutomationPipeline?.targetColumnId,
            });
          if (updateLeadColumnId) {
            this.logger.log(
              `The tag automation condition pipeline with sales successfully, lead id ${leadId}`,
            );
          }
        }

        return {
          statusCode: 200,
          reason: 'Tag automation successfully triggered!',
        };
      } else if (
        conditionType === 'communication' &&
        tagId &&
        rule?.tagAutomationCommunication
      ) {
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
        const lead = (await this.globalRepository.findLeadById(
          leadId as number,
          companyId as number,
          {
            include: {
              Client: true,
            },
          },
        )) as Lead & { Client: Client[] };

        const vehicleInfo = lead.vehicleId
          ? await this.globalRepository.findVehicleById(lead.vehicleId, {
              select: { id: true, make: true, model: true, year: true },
            })
          : invoice?.vehicleId
            ? await this.globalRepository.findVehicleById(invoice.vehicleId, {
                select: { id: true, make: true, model: true, year: true },
              })
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
            },
          },
        );

        const placeholdersValue: TPlaceholder = {
          contactName: `${lead ? lead?.clientName : invoice?.client?.firstName}`,
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
          rule?.tagAutomationCommunication?.emailBody || '',
          placeholdersValue,
        );

        const formattedSmsBody = this.mailUtils.formatBody(
          rule?.tagAutomationCommunication?.smsBody || '',
          placeholdersValue,
        );

        const attachmentUrls =
          rule?.tagAutomationCommunication?.attachments.map(
            (attachment) => attachment.fileUrl,
          );

        if (
          rule?.tagAutomationCommunication?.communicationType === 'EMAIL' ||
          rule?.tagAutomationCommunication?.communicationType === 'BOTH'
        ) {
          await this.mailService.sendEmail({
            subject: rule?.tagAutomationCommunication?.subject || '',
            clientEmail: lead
              ? lead.clientEmail!
              : invoice
                ? invoice.client.email!
                : ' ',
            emailBody: formattedEmailBody,
            companyEmail: companyInfo?.email || '',
            companyId: companyId,
            attachments: attachmentUrls,
            clientId: vehicleInfo?.clientId ?? lead.clientId!,
          });
        }

        if (
          rule?.tagAutomationCommunication?.communicationType === 'SMS' ||
          rule?.tagAutomationCommunication?.communicationType === 'BOTH'
        ) {
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

        if (
          rule?.tagAutomationCommunication?.communicationType === 'SMS' ||
          rule?.tagAutomationCommunication?.communicationType === 'BOTH'
        ) {
          if (
            companyInfo &&
            invoice?.client &&
            invoice?.client.mobile &&
            isValidUSMobile(invoice?.client.mobile)
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
      } else if (
        conditionType === 'post_tag' &&
        !tagId &&
        rule?.PostTagAutomationColumn
      ) {
        if (invoiceId) {
          if (rule?.ruleType === 'one_time' && invoice?.isTriggered) {
            this.logger.log(
              `The tag automation post tag already triggered on this invoice ${invoice?.id} id!`,
            );

            return;
          }

          const invoiceTags = invoice?.tags || [];

          const ruleTags = rule?.tag || [];

          const existingTagIds = invoiceTags.map((t: InvoiceTags) => t.tagId);
          const ruleTagIds = ruleTags.map((t) => t.id);

          // Step 2: find missing tags
          const missingTagIds = ruleTagIds.filter(
            (id) => !existingTagIds.includes(id),
          );

          if (missingTagIds.length > 0) {
            const updatedLead =
              await this.globalRepository.updatePipelineInvoiceTags({
                invoiceId,
                companyId,
                tags: missingTagIds,
              });

            if (updatedLead) {
              this.logger.log(
                `The tag automation post tag created on lead: ${invoice?.id} id!`,
              );
            }
          }
        } else {
          if (rule?.ruleType === 'one_time' && lead?.isTriggered) {
            this.logger.log(
              `The tag automation post tag already triggered on this lead ${lead?.id} id!`,
            );

            return;
          }

          const leadTags = lead?.leadTags || [];

          const ruleTags = rule?.tag || [];

          const existingTagIds = leadTags.map((t: LeadTags) => t.tagId);
          const ruleTagIds = ruleTags.map((t) => t.id);

          console.log('existingTagIds', existingTagIds);
          // Step 2: find missing tags
          const missingTagIds = ruleTagIds.filter(
            (id) => !existingTagIds.includes(id),
          );
          console.log('missingTagIds', missingTagIds);
          if (missingTagIds.length > 0) {
            const updatedLead =
              await this.globalRepository.updatePipelineLeadTags({
                leadId,
                companyId,
                tags: missingTagIds,
              });
            console.log('updatedLead', updatedLead);
            if (updatedLead) {
              this.logger.log(
                `The tag automation post tag created on lead: ${lead?.id} id!`,
              );
            }
          }
        }
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
        reason: 'Execution failed',
        error: error.message,
      };
    }
  }
}
