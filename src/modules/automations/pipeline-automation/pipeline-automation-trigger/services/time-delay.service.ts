import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ExecutionStatus } from '@prisma/client';
import { PipelineAutomationTriggerRepository } from '../repository/pipeline-automation-trigger.repository';

@Injectable()
export class TimeDelayService {
  private readonly logger = new Logger(TimeDelayService.name);

  constructor(
    @InjectQueue('time-delay-queue') private readonly timeDelayQueue: Queue,
    private readonly pipelineAutomationTriggerRepo: PipelineAutomationTriggerRepository,
  ) {}

  async scheduleTimeDelay(
    ruleId: number,
    leadId: number,
    columnId: number,
    companyId: number,
    delayInSeconds: number,
  ): Promise<{ jobId: string }> {
    try {
      // Get the lead with column change time
      const lead = await this.pipelineAutomationTriggerRepo.findLeadById(
        leadId,
        companyId,
      );

      // Base time from which to calculate the delay
      // Default to current time if columnChangedAt is null
      const baseTime = lead.columnChangedAt || new Date();

      // Calculate delay from the base time
      const executeAt = new Date(baseTime.getTime() + delayInSeconds * 1000);

      // Calculate remaining delay in milliseconds
      const remainingDelay = executeAt.getTime() - Date.now();

      // If the executeAt time is in the past, execute immediately
      const actualDelayMs = Math.max(0, remainingDelay);

      // Create a record in the database
      const timeDelayExecution =
        await this.pipelineAutomationTriggerRepo.createTimeDelayExecution(
          ruleId,
          leadId,
          columnId,
          executeAt,
        );

      // Add job to Redis queue with calculated delay
      const job = await this.timeDelayQueue.add(
        'process-time-delay',
        {
          executionId: timeDelayExecution.id,
          ruleId,
          leadId,
          columnId,
          companyId,
        },
        {
          delay: actualDelayMs, // Use actual calculated delay
          jobId: `${timeDelayExecution.id}`,
          removeOnComplete: true,
        },
      );

      // Update the record with the job ID
      await this.pipelineAutomationTriggerRepo.updateTimeDelayExecution(
        timeDelayExecution.id,
        job.id.toString(),
      );

      this.logger.log(
        `Scheduled time delay job ${job.id} for lead ${leadId} in column ${columnId} with delay ${delayInSeconds} seconds`,
      );

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(`Failed to schedule time delay: ${error.message}`);
      throw error;
    }
  }

  async cancelTimeDelay(jobId: string): Promise<boolean> {
    try {
      // Remove job from queue
      await this.timeDelayQueue.removeJobs(jobId);

      // Update database record
      await this.pipelineAutomationTriggerRepo.updateExecutionStatus(
        parseInt(jobId),
        ExecutionStatus.CANCELLED,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to cancel time delay job ${jobId}: ${error.message}`,
      );
      return false;
    }
  }
}
