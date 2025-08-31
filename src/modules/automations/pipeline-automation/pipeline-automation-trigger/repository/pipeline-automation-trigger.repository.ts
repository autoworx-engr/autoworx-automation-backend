import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConditionType, Lead } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { IPipelineAutomationRule } from '../interfaces/pipeline-automation-trigger.interface';

@Injectable()
export class PipelineAutomationTriggerRepository {
  private readonly logger = new Logger(
    PipelineAutomationTriggerRepository.name,
  );
  constructor(private readonly prisma: PrismaService) {}
  async findPipelineAutomationRulesByCondition(
    condition: ConditionType,
    companyId: number,
  ): Promise<IPipelineAutomationRule[]> {
    const results = await this.prisma.pipelineAutomationRule.findMany({
      where: {
        conditionType: condition,
        companyId,
        isPaused: false,
      },
      include: {
        stages: true,
      },
    });

    if (!results || results.length === 0) {
      this.logger.log(`Pipeline automation rules not found!`);
    }

    return results as IPipelineAutomationRule[];
  }

  async findLeadById(leadId: number, companyId: number): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        companyId,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }
  async findPipelineRuleById(ruleId: number): Promise<IPipelineAutomationRule> {
    const rule = await this.prisma.pipelineAutomationRule.findUnique({
      where: { id: ruleId },
      include: {
        stages: true,
        targetColumn: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID ${ruleId} not found`);
    }

    return rule as IPipelineAutomationRule;
  }

  async updatePipelineLeadColumn({
    companyId,
    leadId,
    targetedColumnId,
  }: {
    companyId: number;
    leadId: number;
    targetedColumnId: number;
  }): Promise<Lead> {
    const findLead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        companyId,
      },
    });

    if (!findLead) {
      throw new NotFoundException('Lead not found');
    }

    // Update the lead with new column and track the column change time
    const updatedLead = await this.prisma.lead.update({
      where: {
        id: leadId,
        companyId,
      },
      data: {
        columnId: targetedColumnId,
        columnChangedAt: new Date(), // Track when the column change happened
      },
    });
    return updatedLead;
  }

  async createTimeDelayExecution(
    ruleId: number,
    leadId: number,
    columnId: number,
    executeAt: Date,
  ) {
    return this.prisma.timeDelayExecution.create({
      data: {
        pipelineRuleId: ruleId,
        leadId,
        columnId,
        status: 'PENDING',
        executeAt,
      },
    });
  }

  async updateTimeDelayExecution(id: number, jobId: string) {
    return this.prisma.timeDelayExecution.update({
      where: { id },
      data: { jobId },
    });
  }

  async updateExecutionStatus(
    executionId: number,
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
  ) {
    return this.prisma.timeDelayExecution.update({
      where: { id: executionId },
      data: { status },
    });
  }

  async findTimeDelayRulesByColumnId(
    columnId: number,
    companyId: number,
  ): Promise<IPipelineAutomationRule[]> {
    const results = await this.prisma.pipelineAutomationRule.findMany({
      where: {
        conditionType: ConditionType.TIME_DELAY,
        companyId,
        isPaused: false,
        stages: {
          some: {
            columnId: columnId,
          },
        },
      },
      include: {
        stages: true,
      },
      orderBy: {
        timeDelay: 'asc', // Order by smallest time delay first
      },
    });

    return results as IPipelineAutomationRule[];
  }

  async findTimeDelayExecution(executionId: number) {
    return this.prisma.timeDelayExecution.findUnique({
      where: { id: executionId },
    });
  }
}
