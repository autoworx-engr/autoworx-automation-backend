import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ExecutionStatus } from '@prisma/client';
import { PipelineAutomationTriggerRepository } from '../repository/pipeline-automation-trigger.repository';
import { TimeDelayRuleService } from '../services/time-delay-rule.service';
import { CommunicationAutomationRuleService } from '../services/communication-automation-rule.service';

@Processor('pipeline-time-delay')
export class TimeDelayProcessor {
  private readonly logger = new Logger(TimeDelayProcessor.name);
  constructor(
    private readonly pipelineAutomationTriggerRepo: PipelineAutomationTriggerRepository,
    private readonly timeDelayRuleService: TimeDelayRuleService,
    private readonly communicationAutomationRuleService: CommunicationAutomationRuleService,
  ) {}

  @Process('process-time-delay')
  async processTimeDelay(job: Job) {
    try {
      const { executionId, ruleId, leadId, companyId } = job.data;

      // Get execution details
      const execution =
        await this.pipelineAutomationTriggerRepo.findTimeDelayExecution(
          executionId,
        );

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found, skipping`);
        return { success: false, reason: 'Execution not found' };
      }

      // Get rule details to check if still active and not paused
      const rule =
        await this.pipelineAutomationTriggerRepo.findPipelineRuleById(ruleId);

      if (rule.isPaused) {
        this.logger.warn(`Rule ${ruleId} is paused, skipping execution`);
        await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Rule is paused' };
      }

      if (!rule.targetColumnId) {
        this.logger.warn(
          `Rule ${ruleId} has no target column, skipping execution`,
        );
        await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
          executionId,
          ExecutionStatus.FAILED,
        );
        return { success: false, reason: 'No target column defined' };
      }

      // Check if lead still exists and is in the right column
      const lead = await this.pipelineAutomationTriggerRepo.findLeadById(
        leadId,
        companyId,
      );

      if (lead.columnId !== execution.columnId) {
        this.logger.warn(
          `Lead ${leadId} is no longer in the original column ${execution.columnId}, current column: ${lead.columnId}`,
        );
        await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
          executionId,
          ExecutionStatus.CANCELLED,
        );
        return { success: false, reason: 'Lead column changed' };
      } // Update lead column
      await this.pipelineAutomationTriggerRepo.updatePipelineLeadColumn({
        companyId,
        leadId,
        targetedColumnId: rule.targetColumnId,
      }); // Check for time delay rules in the updated column
      await this.timeDelayRuleService.checkAndExecuteTimeDelayInUpdatedColumn(
        companyId,
        leadId,
        rule.targetColumnId,
      );

      // Check for communication automation rules in the updated column
      await this.communicationAutomationRuleService.checkAndExecuteCommunicationRulesInUpdatedColumn(
        companyId,
        leadId,
        rule.targetColumnId,
      );

      // Update execution status
      await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
        executionId,
        ExecutionStatus.COMPLETED,
      );

      this.logger.log(
        `Time delay execution ${executionId} completed successfully`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error processing time delay job ${job.id}: ${error.message}`,
        error.stack,
      );

      // Update execution status to FAILED
      await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
        job.data.executionId,
        ExecutionStatus.FAILED,
      );
      throw error;
    }
  }
}
