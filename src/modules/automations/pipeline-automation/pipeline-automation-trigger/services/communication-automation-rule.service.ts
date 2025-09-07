import { Injectable, Logger } from '@nestjs/common';
import { CommunicationAutomationTriggerRepository } from '../../../communication-automation/communication-automation-trigger/repository/communication-automation-trigger.repository';
import { CommunicationAutomationTriggerService } from '../../../communication-automation/communication-automation-trigger/communication-automation-trigger.service';

@Injectable()
export class CommunicationAutomationRuleService {
  private readonly logger = new Logger(CommunicationAutomationRuleService.name);

  constructor(
    private readonly communicationAutomationTriggerRepo: CommunicationAutomationTriggerRepository,
    private readonly communicationAutomationTriggerService: CommunicationAutomationTriggerService,
  ) {}

  /**
   * Check for communication automation rules in the updated column and execute them
   */
  async checkAndExecuteCommunicationRulesInUpdatedColumn(
    companyId: number,
    leadId: number,
    columnId: number,
  ): Promise<void> {
    try {
      // Find all communication automation rules for the company
      const communicationRules =
        await this.communicationAutomationTriggerRepo.findAllRule(companyId);

      if (!communicationRules || communicationRules.length === 0) {
        this.logger.log(
          `No communication automation rules found for company ${companyId}`,
        );
        return;
      }

      // Find rules that apply to the updated column
      const applicableRules = communicationRules.filter((rule) => {
        // Skip paused rules
        if (rule.isPaused) {
          return false;
        }

        // Check if rule applies to the current column
        return rule?.stages?.some((stage) => stage.columnId === columnId);
      });

      if (applicableRules.length === 0) {
        this.logger.log(
          `No applicable communication automation rules found for column ${columnId}`,
        );
        return;
      }

      this.logger.log(
        `Found ${applicableRules.length} applicable communication automation rule(s) for column ${columnId}`,
      );

      // Execute all applicable rules
      for (const rule of applicableRules) {
        try {
          this.logger.log(
            `Executing communication automation rule ${rule.id} for lead ${leadId} in column ${columnId}`,
          );

          // Schedule the communication automation
          await this.communicationAutomationTriggerService.scheduleTimeDelay({
            ruleId: rule.id,
            leadId,
            columnId,
            companyId,
            delayInSeconds: rule.timeDelay || 0, // Default to 0 if no delay
          });

          this.logger.log(
            `Successfully scheduled communication automation rule ${rule.id} for lead ${leadId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to execute communication automation rule ${rule.id} for lead ${leadId}: ${error.message}`,
          );
          // Continue with other rules even if one fails
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check and execute communication automation rules in updated column: ${error.message}`,
      );
      // Don't throw the error to avoid disrupting the main flow
    }
  }
}
