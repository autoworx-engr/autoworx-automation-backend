import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommunicationAutomationTriggerRepository {
  private readonly logger = new Logger(
    CommunicationAutomationTriggerRepository.name,
  );
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'communication_automation_rule:';
  private readonly RULES_LIST_KEY = 'communication_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async findAllRule(companyId: number) {
    // Try to get from cache first
    // const cacheKey = `${this.RULES_LIST_KEY}${companyId}`;
    // const cachedRules = await this.cacheManager.get<string>(cacheKey);
    // if (cachedRules) {
    //   return JSON.parse(cachedRules);
    // }

    const result = await this.prisma.communicationAutomationRule.findMany({
      where: {
        companyId,
      },
      include: {
        stages: true,
      },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException('Communication automation rules not found');
    }

    // Save to cache
    // await this.cacheManager.set(
    //   cacheKey,
    //   JSON.stringify(result),
    //   this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    // );
    return result;
  }

  async findRuleById(ruleId: number) {
    // Try to get from cache first
    // const cacheKey = `${this.RULE_CACHE_KEY}${ruleId}`;
    // const cachedRule = await this.cacheManager.get<string>(cacheKey);
    // if (cachedRule) {
    //   return JSON.parse(cachedRule);
    // }

    const result = await this.prisma.communicationAutomationRule.findUnique({
      where: { id: ruleId },
      include: {
        stages: true,
        attachments: true,
      },
    });

    if (!result) {
      throw new NotFoundException(
        `Communication automation rule with ID ${ruleId} not found`,
      );
    }

    // Save to cache
    // await this.cacheManager.set(
    //   cacheKey,
    //   JSON.stringify(result),
    //   this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    // );
    return result;
  }

  findCalenderSettings(companyId: number) {
    return this.prisma.calendarSettings.findFirst({
      where: {
        companyId,
      },
    });
  }

  /**
   * Get company timezone
   * @param companyId The ID of the company
   * @returns The timezone string for the company or UTC as default
   */
  async getCompanyTimezone(companyId: number): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    return company?.timezone || 'UTC';
  }

  /**
   * Get calendar settings for a company
   * @param companyId The ID of the company
   * @returns Calendar settings for the company or null if not found
   */
  async getCalendarSettings(companyId: number) {
    return this.prisma.calendarSettings.findFirst({
      where: {
        companyId,
      },
    });
  }

  /**
   * Get weekend days configuration for a company
   * @param companyId The ID of the company
   * @returns Calendar settings for the company containing weekend days
   */
  async getWeekendDaysForCompany(companyId: number) {
    const calendarSettings = await this.prisma.calendarSettings.findFirst({
      where: {
        companyId,
      },
      select: {
        weekend1: true,
        weekend2: true,
      },
    });

    return calendarSettings;
  }
}
