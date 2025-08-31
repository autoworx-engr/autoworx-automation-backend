import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryAutomationRepository } from './repositories/inventory-automation-rule.repositories';
import { CreateInventoryRuleDto } from './dto/create-inventory-rule.dto';
import { UpdateInventoryRuleDto } from './dto/update-inventory-rule.dto';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class InventoryAutomationRuleService {
  constructor(
    private readonly repository: InventoryAutomationRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  private readonly RULE_CACHE_KEY = 'inventory_automation_rule:';
  private readonly RULES_LIST_KEY = 'inventory_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async create(data: CreateInventoryRuleDto) {
    const cachedListKey = `${this.RULES_LIST_KEY}${data.companyId}`;
    const rule = await this.repository.create(data);

    // Invalidate rules list cache for the company
    await this.cacheManager.del(cachedListKey);
    // Cache the individual rule
    await this.cacheManager.set(
      `${this.RULE_CACHE_KEY}${rule.id}`,
      JSON.stringify(rule),
      this.CACHE_TTL * 1000,
    );
    return rule;
  }

  async getAll(companyId: number) {
    const cachedListKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cached = await this.cacheManager.get<string>(cachedListKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const rules = await this.repository.findAll(companyId);
    await this.cacheManager.set(
      cachedListKey,
      JSON.stringify(rules),
      this.CACHE_TTL * 1000,
    );
    return rules;
  }

  async getOne(id: number) {
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    const cached = await this.cacheManager.get<string>(cachedKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const rule = await this.repository.findOne(id);
    if (!rule) {
      throw new NotFoundException(
        `The inventory automation rule with ID #${id} was not found`,
      );
    }

    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rule),
      this.CACHE_TTL * 1000,
    );
    return rule;
  }

  async update(id: number, data: UpdateInventoryRuleDto) {
    // first check is exist in database
    const existing = await this.repository.findOne(id);
    if (!existing) {
      throw new NotFoundException(
        `The inventory automation rule with ID #${id} was not found`,
      );
    }
    const updated = await this.repository.update(id, data);
    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    await this.cacheManager.del(`${this.RULES_LIST_KEY}${existing.companyId}`);
    return updated;
  }

  async delete(id: number) {
    const existing = await this.repository.findOne(id);
    if (!existing) {
      throw new NotFoundException(
        `The inventory automation rule with ID #${id} was not found`,
      );
    }

    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    await this.cacheManager.del(`${this.RULES_LIST_KEY}${existing.companyId}`);
    return this.repository.remove(id);
  }
}
