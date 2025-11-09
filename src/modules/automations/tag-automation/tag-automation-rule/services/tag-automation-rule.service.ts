import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TagAutomationRule } from '@prisma/client';
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';
import { TagAutomationRuleRepository } from '../repositories/tag-automation-rule.repository';

@Injectable()
export class TagAutomationRuleService {
  private readonly logger = new Logger(TagAutomationRuleService.name);
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 days (seconds)
  private readonly PREFIX = 'tag_automation_rule';

  constructor(
    private readonly tagRuleRepository: TagAutomationRuleRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async getVersion(): Promise<number> {
    const version = await this.cacheManager.get<number>(
      `${this.PREFIX}:version`,
    );
    return version || 1;
  }

  private async incrementVersion(): Promise<void> {
    const version = await this.getVersion();
    await this.cacheManager.set(
      `${this.PREFIX}:version`,
      version + 1,
      this.CACHE_TTL,
    );
  }

  private async buildListKey(companyId: number): Promise<string> {
    const version = await this.getVersion();
    return `${this.PREFIX}:list:v${version}:company:${companyId}`;
  }

  private buildRuleKey(id: number): string {
    return `${this.PREFIX}:rule:${id}`;
  }

  async create(createDto: CreateTagAutomationRuleDto) {
    const createdRule = await this.tagRuleRepository.createRule(createDto);

    await this.incrementVersion(); // Invalidate all list caches
    const individualKey = this.buildRuleKey(createdRule.id);
    await this.cacheManager.set(individualKey, createdRule, this.CACHE_TTL);

    this.logger.log(`Created rule cached at ${individualKey}`);
    return createdRule;
  }

  async findAll(companyId: number): Promise<TagAutomationRule[]> {
    const listKey = await this.buildListKey(companyId);
    const cachedRules =
      await this.cacheManager.get<TagAutomationRule[]>(listKey);

    if (cachedRules) {
      this.logger.log(`Cache hit for company ${companyId}`);
      return cachedRules;
    }

    const rules = await this.tagRuleRepository.findAllRules(companyId);
    await this.cacheManager.set(listKey, rules, this.CACHE_TTL);

    this.logger.log(`Cache set for ${listKey}`);
    return rules;
  }

  async findOne(id: number): Promise<TagAutomationRule> {
    const ruleKey = this.buildRuleKey(id);
    const cachedRule = await this.cacheManager.get<TagAutomationRule>(ruleKey);

    if (cachedRule) {
      this.logger.log(`Cache hit for rule ${id}`);
      return cachedRule;
    }

    const rule = await this.tagRuleRepository.findRuleById(id);
    if (!rule) throw new NotFoundException(`Rule with ID ${id} not found`);

    await this.cacheManager.set(ruleKey, rule, this.CACHE_TTL);
    return rule;
  }

  async update(id: number, dto: UpdateTagAutomationRuleDto) {
    const existing = await this.tagRuleRepository.findRuleById(id);
    if (!existing) throw new NotFoundException(`Rule with ID ${id} not found`);

    const updated = await this.tagRuleRepository.updateRule(id, dto);
    const ruleKey = this.buildRuleKey(id);

    await this.cacheManager.del(ruleKey);
    await this.incrementVersion(); // ensures new findAll() fetches fresh data
    await this.cacheManager.set(ruleKey, updated, this.CACHE_TTL);

    this.logger.log(`Updated and recached rule ${id}`);
    return updated;
  }

  async remove(id: number): Promise<{ id: number; message: string }> {
    const existing = await this.tagRuleRepository.findRuleById(id);
    if (!existing) throw new NotFoundException(`Rule with ID ${id} not found`);

    await this.tagRuleRepository.deleteRule(id);
    await this.cacheManager.del(this.buildRuleKey(id));
    await this.incrementVersion();

    return { id, message: 'Tag automation rule deleted successfully' };
  }
}
