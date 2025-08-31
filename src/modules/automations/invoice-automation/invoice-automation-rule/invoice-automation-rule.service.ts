import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InvoiceAutomationRuleRepository } from './repositories/invoice-automation.repository';
import { CreateInvoiceRuleDto } from './dto/create-invoice-rule.dto';
import { UpdateInvoiceRuleDto } from './dto/update-invoice-rule.dto';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class InvoiceAutomationRuleService {
  private readonly logger = new Logger(InvoiceAutomationRuleService.name);
  constructor(
    private readonly repository: InvoiceAutomationRuleRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'invoice_automation_rule:';
  private readonly RULES_LIST_KEY = 'invoice_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds

  async create(data: CreateInvoiceRuleDto) {
    const cachedKey = `${this.RULES_LIST_KEY}${data.companyId}`;
    const createdRule = await this.repository.create(data);

    // Invalidate the rules list cache for the specific company
    await this.cacheManager.del(cachedKey);

    // Cache the individual rule
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${createdRule.id}`;

    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(createdRule),
      this.CACHE_TTL * 1000,
    );

    this.logger.log(
      `Set the new item in cache lists with the ${individualRuleCacheKey}`,
    );
    return createdRule;
  }

  async findAll(companyId: number) {
    // Try to get from cache first
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(cachedKey);

    if (cachedRules) {
      return JSON.parse(cachedRules);
    }

    const result = await this.repository.findAll(companyId);

    // Save to cache
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    return result;
  }

  async findOne(id: number) {
    // Try to get from cache first
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    const cachedRule = await this.cacheManager.get<string>(cachedKey);
    if (cachedRule) {
      return JSON.parse(cachedRule);
    }

    const automation = await this.repository.findOne(id);

    if (!automation) {
      throw new NotFoundException(`Invoice automation #${id} not found`);
    }

    // Save to cache
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(automation),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    return automation;
  }

  async update(id: number, data: UpdateInvoiceRuleDto) {
    const isExist = await this.findOne(id);

    if (!isExist) {
      throw new NotFoundException(`Invoice rule with ID ${id} not found`);
    }

    const result = await this.repository.update(id, data);

    // Invalidate the cache for the specific rule
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    // Invalidate the rules list cache for the specific company
    if (result && result.companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${result.companyId}`);
    }

    // Cache the updated individual rule
    const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;
    await this.cacheManager.set(
      individualRuleCacheKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    return result;
  }

  async delete(id: number) {
    const automation = await this.findOne(id); // Verify existence

    if (!automation) {
      throw new NotFoundException(`Invoice automation #${id} not found`);
    }
    const result = await this.repository.remove(id);

    // Invalidate the cache for the specific rule
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    if (result && result.companyId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${result.companyId}`);
    }

    return result;
  }
}
