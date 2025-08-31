import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConditionType } from '@prisma/client';
import { CreatePipelineRuleDto } from '../dto/create-pipeline-rule.dto';
import { UpdatePipelineRuleDto } from '../dto/update-pipeline-rule.dto';
import { PipelineAutomationRuleRepository } from '../repositories/pipeline-automation-rule.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class PipelineAutomationRuleService {
  private readonly logger = new Logger(PipelineAutomationRuleService.name);
  private readonly RULE_CACHE_KEY = 'pipeline_automation_rule:';
  private readonly RULES_LIST_KEY = 'pipeline_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds
  constructor(
    private readonly pipelineRuleRepository: PipelineAutomationRuleRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createPipelineRuleDto: CreatePipelineRuleDto) {
    const cachedKey = `${this.RULES_LIST_KEY}${createPipelineRuleDto.companyId}`;
    // Validate required fields based on condition and action types
    this.validateRuleData(createPipelineRuleDto);

    // Create the rule using repository
    const createdRule = await this.pipelineRuleRepository.createRule(
      createPipelineRuleDto,
    );

    // Invalidate the rules list cache for the company
    await this.cacheManager.del(cachedKey);
    this.logger.log(`Invalidate rules list for ${cachedKey}`);
    const result = await this.findOne(createdRule.id);

    // Cache the individual rule
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${result.id}`;
    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000,
    );

    this.logger.log(
      `Set the new item in cache lists with the ${individualRuleCacheKey}`,
    );

    return result;
  }

  async findAll(companyId: number) {
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(cachedKey);

    if (cachedRules) {
      const parsedRules = JSON.parse(cachedRules);
      this.logger.log(`Get from cache for company ${companyId}`);
      return parsedRules;
    }
    const rules = await this.pipelineRuleRepository.findAllRules(companyId);
    const formatted = rules.map((rule) => this.formatRuleResponse(rule));

    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(formatted),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    this.logger.log(`get from the set`);

    return formatted;
  }

  async findOne(id: number) {
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    const cachedRule = await this.cacheManager.get<string>(cachedKey);

    if (cachedRule) {
      return JSON.parse(cachedRule);
    }

    const rule = await this.pipelineRuleRepository.findRuleById(id);

    if (!rule) {
      throw new NotFoundException(`Pipeline rule with ID ${id} not found`);
    }

    const formatted = this.formatRuleResponse(rule);
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(formatted),
      this.CACHE_TTL * 1000,
    );

    return formatted;
  }

  async update(id: number, updatePipelineRuleDto: UpdatePipelineRuleDto) {
    // Check if rule exists
    const existingRule = await this.findOne(id);

    if (!existingRule) {
      throw new NotFoundException(`Pipeline rule with ID ${id} not found`);
    }

    // If there are fields to validate in the update DTO, validate them
    if (Object.keys(updatePipelineRuleDto).length > 0) {
      this.validateRuleData(updatePipelineRuleDto);
    }

    // Update the rule using repository
    await this.pipelineRuleRepository.updateRule(id, updatePipelineRuleDto);

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    if (existingRule.companyId) {
      await this.cacheManager.del(
        `${this.RULES_LIST_KEY}${existingRule.companyId}`,
      );
    }

    // Fetch and return the updated rule
    const updatedRule = await this.findOne(id);
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;

    // Cache the updated individual rule
    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(updatedRule),
      this.CACHE_TTL * 1000,
    );

    this.logger.log(`updated the rule cache for the ${individualRuleCacheKey}`);

    return updatedRule;
  }

  async remove(id: number) {
    // Check if rule exists
    const existingRule = await this.pipelineRuleRepository.findRuleById(id);

    if (!existingRule) {
      throw new NotFoundException(`Pipeline rule with ID ${id} not found`);
    }

    // Delete the rule using repository
    const rule = await this.pipelineRuleRepository.deleteRule(id);

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    if (rule.companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
    }

    return { id, message: 'Pipeline rule deleted successfully' };
  }

  private validateRuleData(ruleData: Partial<CreatePipelineRuleDto>) {
    // For TIME_DELAY condition, timeDelay and timeUnit are required
    if (ruleData.conditionType === ConditionType.TIME_DELAY) {
      if (!ruleData.timeDelay) {
        throw new BadRequestException(
          'Time delay and time unit are required for TIME_DELAY condition',
        );
      }
    }

    // For MOVE_TO_STAGE action, targetColumnId is required
  }

  private formatRuleResponse(rule: any) {
    return {
      id: rule.id,
      title: rule.title,
      stages: rule.stages.map((stage) => ({
        id: stage.id,
        columnId: stage.columnId,
        columnTitle: stage.column?.title,
      })),
      conditionType: rule.conditionType,
      actionType: rule.actionType,
      targetColumnId: rule.targetColumnId,
      targetColumnTitle: rule.targetColumn?.title || null,
      isPaused: rule.isPaused,
      timeDelay: rule.timeDelay,
      timeUnit: rule.timeUnit,
      companyId: rule.companyId,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
