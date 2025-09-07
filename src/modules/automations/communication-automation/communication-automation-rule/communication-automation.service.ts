import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCommunicationAutomationDto } from './dto/create-communication-automation.dto';
import { UpdateCommunicationAutomationDto } from './dto/update-communication-automation.dto';
import { CommunicationAutomationRepository } from './repositories/communication-automation.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import * as moment from 'moment-timezone';

@Injectable()
export class CommunicationAutomationService {
  private readonly logger = new Logger(CommunicationAutomationService.name);
  constructor(
    private readonly repository: CommunicationAutomationRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'communication_automation_rule:';
  private readonly RULES_LIST_KEY = 'communication_automation_rules:list:';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days in seconds

  async create(data: CreateCommunicationAutomationDto) {
    try {
      const createdRule = await this.repository.create(data);

      // Invalidate the rules list cache for the specific company
      const cachedKey = `${this.RULES_LIST_KEY}${data.companyId}`;
      try {
        await this.cacheManager.del(cachedKey);
      } catch (cacheError) {
        this.logger.warn(`Failed to invalidate rules list cache for company ${data.companyId}:`, cacheError);
      }

      // Cache the individual rule
      const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${createdRule.id}`;
      try {
        await this.cacheManager.set(
          individualRuleCacheKey,
          JSON.stringify(createdRule),
          this.CACHE_TTL * 1000,
        );
        this.logger.log(`Cached new rule with key: ${individualRuleCacheKey}`);
      } catch (cacheError) {
        this.logger.warn(`Failed to cache new rule ${createdRule.id}:`, cacheError);
      }

      return createdRule;
    } catch (error) {
      this.logger.error(`Failed to create communication automation rule:`, error);
      throw error;
    }
  }

  async findAll(companyId: number) {
    // Try to get from cache first
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    try {
      const cachedRules = await this.cacheManager.get<string>(cachedKey);
      if (cachedRules) {
        return JSON.parse(cachedRules);
      }
    } catch (cacheError) {
      this.logger.warn(`Failed to get rules list from cache for company ${companyId}:`, cacheError);
    }

    const result = await this.repository.findAll(companyId);
    
    // Save to cache
    try {
      await this.cacheManager.set(
        cachedKey,
        JSON.stringify(result),
        this.CACHE_TTL * 1000, // cache-manager uses milliseconds
      );
    } catch (cacheError) {
      this.logger.warn(`Failed to cache rules list for company ${companyId}:`, cacheError);
    }

    return result;
  }

  async findOne(id: number) {
    // Try to get from cache first
    const cachedKey = `${this.RULE_CACHE_KEY}${id}`;
    try {
      const cachedRule = await this.cacheManager.get<string>(cachedKey);
      if (cachedRule) {
        return JSON.parse(cachedRule);
      }
    } catch (cacheError) {
      this.logger.warn(`Failed to get rule from cache for id ${id}:`, cacheError);
    }

    const automation = await this.repository.findOne(id);
    if (!automation) {
      throw new NotFoundException(`Communication automation #${id} not found`);
    }

    // Save to cache
    try {
      await this.cacheManager.set(
        cachedKey,
        JSON.stringify(automation),
        this.CACHE_TTL * 1000, // cache-manager uses milliseconds
      );
    } catch (cacheError) {
      this.logger.warn(`Failed to cache rule ${id}:`, cacheError);
    }

    return automation;
  }

  async update(id: number, data: UpdateCommunicationAutomationDto) {
    const existingRule = await this.repository.findOne(id);
    if (!existingRule) {
      throw new NotFoundException(`Communication rule with ID ${id} not found`);
    }

    try {
      const result = await this.repository.update(id, data);

      // Invalidate caches after successful update
      const promises = [
        this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`),
        this.cacheManager.del(`${this.RULES_LIST_KEY}${existingRule.companyId}`)
      ];

      // If company changed, also invalidate the new company's list cache
      if (result.companyId !== existingRule.companyId) {
        promises.push(this.cacheManager.del(`${this.RULES_LIST_KEY}${result.companyId}`));
      }

      await Promise.allSettled(promises);

      // Cache the updated individual rule
      const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;
      try {
        await this.cacheManager.set(
          individualRuleCacheKey,
          JSON.stringify(result),
          this.CACHE_TTL * 1000, // cache-manager uses milliseconds
        );
      } catch (cacheError) {
        this.logger.warn(`Failed to cache updated rule ${id}:`, cacheError);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to update rule ${id}:`, error);
      throw error;
    }
  }

  async remove(id: number) {
    // Get the rule first to know the companyId, but don't cache it
    const automation = await this.repository.findOne(id);
    if (!automation) {
      throw new NotFoundException(`Communication automation #${id} not found`);
    }

    try {
      const result = await this.repository.remove(id);

      // Invalidate caches after successful removal
      const promises = [
        this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`),
        this.cacheManager.del(`${this.RULES_LIST_KEY}${automation.companyId}`)
      ];

      await Promise.allSettled(promises);

      return result;
    } catch (error) {
      this.logger.error(`Failed to remove rule ${id}:`, error);
      throw error;
    }
  }

  async togglePause(id: number, companyId: number) {
    // Check existence without caching to avoid race conditions
    const existingRule = await this.repository.findOne(id);
    if (!existingRule) {
      throw new NotFoundException(`Communication automation #${id} not found`);
    }

    try {
      const result = await this.repository.togglePause(id, companyId);

      // Invalidate caches after successful toggle
      const promises = [
        this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`),
        this.cacheManager.del(`${this.RULES_LIST_KEY}${result.companyId}`)
      ];

      await Promise.allSettled(promises);

      // Cache the updated individual rule
      const individualRuleCacheKey = `${this.RULE_CACHE_KEY}${id}`;
      try {
        await this.cacheManager.set(
          individualRuleCacheKey,
          JSON.stringify(result),
          this.CACHE_TTL * 1000, // cache-manager uses milliseconds
        );
      } catch (cacheError) {
        this.logger.warn(`Failed to cache toggled rule ${id}:`, cacheError);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to toggle pause for rule ${id}:`, error);
      throw error;
    }
  }
}
