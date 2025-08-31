import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateServiceAutomationRuleDto } from './dto/create-service-automation-rule.dto';
import { UpdateServiceAutomationRuleDto } from './dto/update-service-automation-rule.dto';
import { ServiceAutomationRuleRepository } from './repositories/service-automation-rule.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class ServiceAutomationRuleService {
  private readonly logger = new Logger(ServiceAutomationRuleService.name);
  constructor(
    private readonly serviceAutomationRepo: ServiceAutomationRuleRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'service_automation_rule:';
  private readonly RULES_LIST_KEY = 'service_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds

  async create(createServiceAutomationRuleDto: CreateServiceAutomationRuleDto) {
    const cachedKey = `${this.RULES_LIST_KEY}${createServiceAutomationRuleDto.companyId}`;

    const result = await this.serviceAutomationRepo.create(
      createServiceAutomationRuleDto,
    );

    // Invalidate the rules list cache for the company
    await this.cacheManager.del(cachedKey);

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
    const rules = await this.serviceAutomationRepo.findAll(companyId);
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rules),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    return rules;
  }

  async findOne(id: number) {
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    const cachedRule = await this.cacheManager.get<string>(cachedKey);

    if (cachedRule) {
      return JSON.parse(cachedRule);
    }
    const rule = await this.serviceAutomationRepo.findById(id, {
      include: {
        serviceMaintenanceStage: true,
        attachments: true,
      },
    });
    if (!rule) {
      throw new NotFoundException(`Service rule with ID ${id} not found`);
    }

    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rule),
      this.CACHE_TTL * 1000,
    );

    return rule;
  }

  async update(
    id: number,
    updateServiceAutomationRuleDto: UpdateServiceAutomationRuleDto,
  ) {
    const updatedRule = await this.serviceAutomationRepo.update(
      id,
      updateServiceAutomationRuleDto,
    );
    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    await this.cacheManager.del(
      `${this.RULES_LIST_KEY}${updateServiceAutomationRuleDto?.companyId}`,
    );

    // Cache the updated individual rule
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;
    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(updatedRule),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );
    return updatedRule;
  }

  async remove(id: number) {
    const rule = await this.serviceAutomationRepo.findById(id, {
      include: {
        serviceMaintenanceStage: true,
        attachments: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Service rule with ID ${id} not found`);
    }

    //remove for the companyId also

    await this.serviceAutomationRepo.delete(id);

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    if (rule.companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
    }

    return { id, message: 'Service rule deleted successfully' };
  }
}
