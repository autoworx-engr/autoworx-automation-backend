import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdatePipelineAutomationTriggerDto } from '../dto/update-pipeline-automation-trigger.dto';
import { PipelineAutomationTriggerRepository } from '../repository/pipeline-automation-trigger.repository';
import { ConditionType, Lead } from '@prisma/client';
import { pipelineConditionTypeEnum } from '../enum/pipeline-automation-trigger.enum';
import { TimeDelayService } from './time-delay.service';
import { TimeDelayRuleService } from './time-delay-rule.service';
import { CommunicationAutomationRuleService } from './communication-automation-rule.service';

@Injectable()
export class PipelineAutomationTriggerService {
  private readonly logger = new Logger(PipelineAutomationTriggerService.name);
  constructor(
    private readonly pipelineAutomationTriggerRepo: PipelineAutomationTriggerRepository,
    private readonly timeDelayService: TimeDelayService,
    private readonly timeDelayRuleService: TimeDelayRuleService,
    private readonly communicationAutomationRuleService: CommunicationAutomationRuleService,
  ) {}

  async update(
    updatePipelineAutomationTriggerDto: UpdatePipelineAutomationTriggerDto,
  ) {
    const { companyId, leadId, columnId, condition } =
      updatePipelineAutomationTriggerDto || {};

    this.logger.log(`Pipeline automation triggered for lead ID ${leadId}!`);

    if (pipelineConditionTypeEnum.indexOf(condition) === -1) {
      throw new Error('Invalid condition type');
    }

    const pipelineAutomationRules =
      await this.pipelineAutomationTriggerRepo.findPipelineAutomationRulesByCondition(
        condition,
        companyId,
      );

    // Find the first active rule that applies to the current column
    const applicableRule = pipelineAutomationRules.find((rule) => {
      // Rule applies to the current column
      return rule.stages.some((stage) => stage.columnId === columnId);
    });

    if (!applicableRule) {
      this.logger.log('No applicable active rule found for this column');
      return;
    }

    if (!applicableRule.targetColumnId) {
      this.logger.log('Target column ID not found');
      return;
    }

    // Handle TIME_DELAY condition
    if (condition === ConditionType.TIME_DELAY) {
      if (!applicableRule.timeDelay) {
        throw new Error('Time delay not configured for this rule');
      }

      this.logger.log(
        `Scheduling time delay for lead ${leadId} with delay ${applicableRule.timeDelay} seconds`,
      );

      return this.timeDelayService.scheduleTimeDelay(
        applicableRule.id,
        leadId,
        columnId,
        companyId,
        applicableRule.timeDelay,
      );
    } // Handle immediate execution for other conditions
    const updatedLead =
      await this.pipelineAutomationTriggerRepo.updatePipelineLeadColumn({
        companyId,
        leadId,
        targetedColumnId: applicableRule.targetColumnId,
      }); // Check for time delay rules in the updated column
    await this.timeDelayRuleService.checkAndExecuteTimeDelayInUpdatedColumn(
      companyId,
      leadId,
      applicableRule.targetColumnId,
    );

    // Check for communication automation rules in the updated column
    await this.communicationAutomationRuleService.checkAndExecuteCommunicationRulesInUpdatedColumn(
      companyId,
      leadId,
      applicableRule.targetColumnId,
    );
    return updatedLead;
  }
}
