import { Injectable, Logger } from '@nestjs/common';
import { PipelineAutomationTriggerRepository } from '../repository/pipeline-automation-trigger.repository';
import { TimeDelayService } from './time-delay.service';

@Injectable()
export class TimeDelayRuleService {
  private readonly logger = new Logger(TimeDelayRuleService.name);

  constructor(
    private readonly pipelineAutomationTriggerRepo: PipelineAutomationTriggerRepository,
    private readonly timeDelayService: TimeDelayService,
  ) {}

  /**
   * Check for time delay rules in the updated column and execute the smallest delay
   */
  async checkAndExecuteTimeDelayInUpdatedColumn(
    companyId: number,
    leadId: number,
    columnId: number,
  ): Promise<void> {
    try {
      // Find all time delay rules for the updated column
      const timeDelayRules =
        await this.pipelineAutomationTriggerRepo.findTimeDelayRulesByColumnId(
          columnId,
          companyId,
        );

      if (timeDelayRules.length === 0) {
        this.logger.log(`No time delay rules found for column ${columnId}`);
        return;
      }

      // Get the rule with the smallest time delay (already ordered by timeDelay ASC)
      const smallestDelayRule = timeDelayRules[0];

      if (!smallestDelayRule.timeDelay) {
        this.logger.warn(
          `Time delay rule ${smallestDelayRule.id} has no time delay configured`,
        );
        return;
      }
      if (!smallestDelayRule.targetColumnId) {
        this.logger.warn(
          `Time delay rule ${smallestDelayRule.id} has no target column configured`,
        );
        return;
      }

      // Prevent infinite loops - don't schedule if target column is the same as current column
      if (smallestDelayRule.targetColumnId === columnId) {
        this.logger.warn(
          `Time delay rule ${smallestDelayRule.id} has the same target column as current column ${columnId}, skipping to prevent infinite loop`,
        );
        return;
      }

      this.logger.log(
        `Scheduling time delay for lead ${leadId} in column ${columnId} with smallest delay ${smallestDelayRule.timeDelay} seconds`,
      );

      // Schedule the time delay for the smallest delay rule
      await this.timeDelayService.scheduleTimeDelay(
        smallestDelayRule.id,
        leadId,
        columnId,
        companyId,
        smallestDelayRule.timeDelay,
      );
    } catch (error) {
      this.logger.error(
        `Failed to check and execute time delay in updated column: ${error.message}`,
      );
      // Don't throw the error to avoid disrupting the main flow
    }
  }
}
