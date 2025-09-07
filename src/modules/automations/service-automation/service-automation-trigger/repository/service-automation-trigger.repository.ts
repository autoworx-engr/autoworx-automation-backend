import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServiceAutomationTriggerRepository {
  private readonly logger = new Logger(ServiceAutomationTriggerRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'service_automation_rule:';
  private readonly RULES_LIST_KEY = 'service_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async findAllRule(companyId: number) {
    // Try to get from cache first
    // const cacheKey = `${this.RULES_LIST_KEY}${companyId}`;
    // const cachedRules = await this.cacheManager.get<string>(cacheKey);
    // if (cachedRules) {

    //   return JSON.parse(cachedRules);
    // }

    const result = await this.prisma.serviceMaintenanceAutomationRule.findMany({
      where: {
        companyId,
      },
      include: {
        serviceMaintenanceStage: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException('Service automation rules not found');
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

    const result =
      await this.prisma.serviceMaintenanceAutomationRule.findUnique({
        where: { id: ruleId },
        include: {
          serviceMaintenanceStage: true,
          attachments: true,
        },
      });

    if (!result) {
      throw new NotFoundException(
        `Service automation rule with ID ${ruleId} not found`,
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
}
