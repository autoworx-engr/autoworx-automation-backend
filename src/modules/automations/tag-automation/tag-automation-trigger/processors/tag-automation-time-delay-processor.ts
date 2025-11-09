import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ExecutionStatus } from '@prisma/client';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { MailUtils } from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
// import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TimeDelayRuleService } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/services/time-delay-rule.service';
import { TagAutomationTriggerRepository } from '../repository/tag-automation-trigger.repository';

@Processor('tag-time-delay')
export class TagTimeDelayProcessor {
  constructor(
    private readonly globalRepository: GlobalRepository,
    private readonly tagAutomationRepository: TagAutomationTriggerRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => TimeDelayRuleService))
    private readonly timeDelayRuleService: TimeDelayRuleService,
  ) {}
  private readonly logger = new Logger(TagTimeDelayProcessor.name);

  @Process('process-tag-time-delay')
  async processTagTimeDelay(job: Job) {
    const { executionId, ruleId, companyId, conditionType, leadId } = job.data;

    try {
      const execution =
        await this.globalRepository.findTimeDelayExecution(executionId);

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found, skipping`);
        return { success: false, reason: 'Execution not found' };
      }

      const rule = await this.tagAutomationRepository.findRuleById(ruleId);
      const lead = await this.globalRepository.findLeadById(leadId, companyId);

      if (
        conditionType === 'pipeline' &&
        rule?.tagAutomationPipeline?.targetColumnId
      ) {
        const updateLeadColumnId =
          await this.globalRepository.updatePipelineLeadColumn({
            companyId,
            leadId,
            targetedColumnId: rule?.tagAutomationPipeline?.targetColumnId,
          });
        console.log(
          'tag pipeline automation trigger successfully',
          updateLeadColumnId,
        );
        return {
          statusCode: 200,
          reason: 'Tag automation successfully triggered!',
        };
      } else if (
        conditionType === 'communication' &&
        rule?.tagAutomationCommunication
      ) {
        console.log('tag communication');
      } else if (
        conditionType === 'post_tag' &&
        rule?.PostTagAutomationColumn
      ) {
        if (rule?.ruleType === 'one_time' && lead?.isTriggered) {
          this.logger.log(
            `The tag automation post tag already triggered on this lead ${lead?.id} id!`,
          );

          return;
        }

        const leadTags = lead?.leadTags || [];

        const ruleTags = rule?.tag || [];

        const existingTagIds = leadTags.map((t) => t.tagId);
        const ruleTagIds = ruleTags.map((t) => t.id);

        // Step 2: find missing tags
        const missingTagIds = ruleTagIds.filter(
          (id) => !existingTagIds.includes(id),
        );

        if (missingTagIds.length > 0) {
          const updatedLead =
            await this.globalRepository.updatePipelineLeadTags({
              leadId,
              companyId,
              tags: missingTagIds,
            });

          if (updatedLead) {
            this.logger.log(
              `The tag automation post tag created on lead: ${lead?.id} id!`,
            );
          }

          return {
            statusCode: 200,
            reason: 'Tag automation successfully triggered!',
          };
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process execution ${executionId}: ${error.message} in tag automation`,
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
