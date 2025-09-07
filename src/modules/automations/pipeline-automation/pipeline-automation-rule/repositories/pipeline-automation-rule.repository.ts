import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePipelineRuleDto } from '../dto/create-pipeline-rule.dto';
import { UpdatePipelineRuleDto } from '../dto/update-pipeline-rule.dto';
@Injectable()
export class PipelineAutomationRuleRepository {
  private readonly logger = new Logger(PipelineAutomationRuleRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'pipeline_automation_rule:';
  private readonly RULES_LIST_KEY = 'pipeline_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async createRule(createPipelineRuleDto: CreatePipelineRuleDto) {
    const { stageIds, ...ruleData } = createPipelineRuleDto;

    const rule = await this.prisma.pipelineAutomationRule.create({
      data: {
        ...ruleData,
        stages: {
          create: stageIds.map((columnId) => ({
            columnId,
          })),
        },
      },
    });

    // Invalidate the rules list cache for the specific company
    // await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);

    return rule;
  }

  async findAllRules(companyId: number) {
    // Try to get from cache first
    // const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    // const cachedRules = await this.cacheManager.get<string>(cachedKey)

    // if (cachedRules) {
    //   return JSON.parse(cachedRules);
    // }

    // If not in cache, get from database
    const rules = await this.prisma.pipelineAutomationRule.findMany({
      where: {
        companyId: companyId ? companyId : undefined,
      },
      include: {
        stages: {
          include: {
            column: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        targetColumn: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Save to cache
    // await this.cacheManager.set(
    //   cachedKey,
    //   JSON.stringify(rules),
    //   this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    // );

    return rules;
  }

  async findRuleById(id: number) {
    // Try to get from cache first
    // const cacheKey = `${this.RULE_CACHE_KEY}${id}`;
    // const cachedRule = await this.cacheManager.get<string>(cacheKey);

    // if (cachedRule) {
    //   return JSON.parse(cachedRule);
    // }

    // If not in cache, get from database
    const rule = await this.prisma.pipelineAutomationRule.findUnique({
      where: { id },
      include: {
        stages: {
          include: {
            column: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        targetColumn: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // if (rule) {
    //   // Save to cache
    //   await this.cacheManager.set(
    //     cacheKey,
    //     JSON.stringify(rule),
    //     this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    //   );
    // }

    return rule;
  }

  async updateRule(id: number, updatePipelineRuleDto: UpdatePipelineRuleDto) {
    const { stageIds, ...ruleData } = updatePipelineRuleDto;

    // Get rule to find companyId before updating
    // const existingRule = await this.prisma.pipelineAutomationRule.findUnique({
    //   where: { id },
    //   select: { companyId: true },
    // });

    const result = await this.prisma.$transaction(async (tx) => {
      // If stageIds are provided, update the stages
      if (stageIds && stageIds.length > 0) {
        // Delete existing stages
        await tx.pipelineStage.deleteMany({
          where: { pipelineRuleId: id },
        });

        // Create new stages
        await tx.pipelineStage.createMany({
          data: stageIds.map((columnId) => ({
            pipelineRuleId: id,
            columnId,
          })),
        });
      }

      // Update the rule
      return tx.pipelineAutomationRule.update({
        where: { id },
        data: ruleData,
      });
    });

    // Invalidate caches
    // await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    // if (existingRule) {
    //   await this.cacheManager.del(`${this.RULES_LIST_KEY}${existingRule.companyId}`);
    // }

    return result;
  }

  async deleteRule(id: number) {
    // Get rule to find companyId before deleting
    // const existingRule = await this.prisma.pipelineAutomationRule.findUnique({
    //   where: { id },
    //   select: { companyId: true },
    // });

    const result = await this.prisma.pipelineAutomationRule.delete({
      where: { id },
    });

    // Invalidate caches
    // await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    // if (existingRule) {
    //   await this.cacheManager.del(`${this.RULES_LIST_KEY}${existingRule.companyId}`);
    // }

    return result;
  }

  // Add method to invalidate all rule caches for a specific company
  async invalidateAllRuleCaches(companyId?: number) {
    if (companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${companyId}`);
    } else {
      // If no companyId provided, this would need a company ID list or pattern matching
      this.logger.warn(
        'Attempted to invalidate all rule caches without company ID',
      );
    }
  }
}
