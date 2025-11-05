// import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
// import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
// import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';
// import { TagAutomationRuleRepository } from '../repositories/tag-automation-rule.repository';

// @Injectable()
// export class TagAutomationRuleService {
//   private readonly logger = new Logger(TagAutomationRuleService.name);
//   private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
//   private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
//   private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds

//   constructor(
//     private readonly tagRuleRepository: TagAutomationRuleRepository,
//     @Inject(CACHE_MANAGER) private cacheManager: Cache,
//   ) {}

//   async create(createDto: CreateTagAutomationRuleDto) {
//     const cachedKey = `${this.RULES_LIST_KEY}${createDto.companyId}`;
//     const createdRule = await this.tagRuleRepository.createRule(createDto);
//     await this.cacheManager.del(cachedKey);
//     this.logger.log(`Invalidate rules list for ${cachedKey}`);
//     const result = await this.findOne(createdRule.id);
//     const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${result.id}`;
//     await this.cacheManager.set(
//       individualRuleCacheKey,
//       JSON.stringify(result),
//       this.CACHE_TTL * 1000,
//     );
//     this.logger.log(
//       `Set the new item in cache lists with the ${individualRuleCacheKey}`,
//     );
//     return result;
//   }

//   async findAll(companyId: number) {
//     const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
//     const cachedRules = await this.cacheManager.get<string>(cachedKey);
//     if (cachedRules) {
//       const parsedRules = JSON.parse(cachedRules);
//       this.logger.log(`Get from cache for company ${companyId}`);
//       return parsedRules;
//     }
//     const rules = await this.tagRuleRepository.findAllRules(companyId);
//     await this.cacheManager.set(
//       cachedKey,
//       JSON.stringify(rules),
//       this.CACHE_TTL * 1000,
//     );
//     this.logger.log(`get from the set`);
//     return rules;
//   }

//   async findOne(id: number) {
//     const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
//     const cachedRule = await this.cacheManager.get<string>(cachedKey);
//     if (cachedRule) {
//       return JSON.parse(cachedRule);
//     }
//     const rule = await this.tagRuleRepository.findRuleById(id);
//     if (!rule) {
//       throw new NotFoundException(
//         `Tag automation rule with ID ${id} not found`,
//       );
//     }
//     await this.cacheManager.set(
//       cachedKey,
//       JSON.stringify(rule),
//       this.CACHE_TTL * 1000,
//     );
//     return rule;
//   }

//   async update(id: number, updateDto: UpdateTagAutomationRuleDto) {
//     const existingRule = await this.findOne(id);
//     if (!existingRule) {
//       throw new NotFoundException(
//         `Tag automation rule with ID ${id} not found`,
//       );
//     }
//     await this.tagRuleRepository.updateRule(id, updateDto);
//     await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
//     if (existingRule.companyId) {
//       await this.cacheManager.del(
//         `${this.RULES_LIST_KEY}${existingRule.companyId}`,
//       );
//     }
//     const updatedRule = await this.findOne(id);
//     const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;
//     await this.cacheManager.set(
//       individualRuleCacheKey,
//       JSON.stringify(updatedRule),
//       this.CACHE_TTL * 1000,
//     );
//     this.logger.log(`updated the rule cache for the ${individualRuleCacheKey}`);
//     return updatedRule;
//   }

//   async remove(id: number) {
//     const existingRule = await this.tagRuleRepository.findRuleById(id);
//     if (!existingRule) {
//       throw new NotFoundException(
//         `Tag automation rule with ID ${id} not found`,
//       );
//     }
//     const rule = await this.tagRuleRepository.deleteRule(id);
//     await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
//     if (rule.companyId) {
//       await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
//     }
//     return { id, message: 'Tag automation rule deleted successfully' };
//   }
// }

import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TagAutomationRule } from '@prisma/client'; // import your Prisma model
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';
import { TagAutomationRuleRepository } from '../repositories/tag-automation-rule.repository';

@Injectable()
export class TagAutomationRuleService {
  private readonly logger = new Logger(TagAutomationRuleService.name);
  private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
  private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds

  constructor(
    private readonly tagRuleRepository: TagAutomationRuleRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(
    createDto: CreateTagAutomationRuleDto,
  ): Promise<TagAutomationRule> {
    const cachedKey = `${this.RULES_LIST_KEY}${createDto.companyId}`;
    const createdRule = await this.tagRuleRepository.createRule(createDto);

    await this.cacheManager.del(cachedKey);
    this.logger.log(`Invalidated rules list cache for ${cachedKey}`);

    const result = await this.findOne(createdRule.id);
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${result.id}`;

    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000,
    );
    this.logger.log(`Cached new rule at ${individualRuleCacheKey}`);

    return result;
  }

  async findAll(companyId: number): Promise<TagAutomationRule[]> {
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(cachedKey);

    if (cachedRules) {
      this.logger.log(`Cache hit for company ${companyId}`);
      return JSON.parse(cachedRules) as TagAutomationRule[];
    }

    const rules = await this.tagRuleRepository.findAllRules(companyId);
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rules),
      this.CACHE_TTL * 1000,
    );
    this.logger.log(`Cached rules for company ${companyId}`);

    return rules;
  }

  async findOne(id: number): Promise<TagAutomationRule> {
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    const cachedRule = await this.cacheManager.get<string>(cachedKey);

    if (cachedRule) {
      return JSON.parse(cachedRule) as TagAutomationRule;
    }

    const rule = await this.tagRuleRepository.findRuleById(id);
    if (!rule)
      throw new NotFoundException(
        `Tag automation rule with ID ${id} not found`,
      );

    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rule),
      this.CACHE_TTL * 1000,
    );
    return rule;
  }

  async update(
    id: number,
    updateDto: UpdateTagAutomationRuleDto,
  ): Promise<TagAutomationRule> {
    const existingRule = await this.findOne(id);
    if (!existingRule)
      throw new NotFoundException(`Rule with ID ${id} not found`);

    await this.tagRuleRepository.updateRule(id, updateDto);
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    if (existingRule.companyId) {
      await this.cacheManager.del(
        `${this.RULES_LIST_KEY}${existingRule.companyId}`,
      );
    }

    const updatedRule = await this.findOne(id);
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;

    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(updatedRule),
      this.CACHE_TTL * 1000,
    );
    this.logger.log(`Updated cache for ${individualRuleCacheKey}`);

    return updatedRule;
  }

  async remove(id: number): Promise<{ id: number; message: string }> {
    const existingRule = await this.tagRuleRepository.findRuleById(id);
    if (!existingRule)
      throw new NotFoundException(`Rule with ID ${id} not found`);

    const rule = await this.tagRuleRepository.deleteRule(id);
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    if (rule.companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
    }

    return { id, message: 'Tag automation rule deleted successfully' };
  }
}
