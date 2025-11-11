import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as moment from 'moment';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMarketingRuleDto } from '../dto/create-marketing-rule.dto';
import { UpdateMarketingRuleDto } from '../dto/update-marketing-rule.dto';

@Injectable()
export class MarketingAutomationRuleRepository {
  private readonly logger = new Logger(MarketingAutomationRuleRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'marketing_automation_rule:';
  private readonly RULES_LIST_KEY = 'marketing_automation_rules:list:'; // Added trailing colon
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async createRule(createMarketingRuleDto: CreateMarketingRuleDto) {
    const { target, attachments, ...restData } = createMarketingRuleDto;

    // Ensure createdBy is never undefined by providing a default value if missing
    const data = {
      ...restData,
      // Convert array to JSON string
      target: JSON.stringify(target),
      createdBy: createMarketingRuleDto.createdBy || 'system',
    };

    const date = moment(data.date);

    const timeObj = new Date(data.startTime);
    const hours = timeObj.getHours();
    const minutes = timeObj.getMinutes();
    const seconds = timeObj.getSeconds();

    // Set the time on the UTC date
    date.set({ hour: hours, minute: minutes, second: seconds, millisecond: 0 });

    // Get the UTC ISO string
    const utcISO = date.toISOString();

    data.startTime = utcISO;
    data.date = new Date(
      moment.utc(data.startTime).startOf('day').toISOString(),
    );
    const rule = await this.prisma.marketingAutomationRule.create({
      data,
    });

    // Invalidate the rules list cache for the specific company
    await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);

    return rule;
  }

  async updateRule(id: number, updateMarketingRuleDto: UpdateMarketingRuleDto) {
    // Get rule to find companyId before updating
    const existingRule = await this.prisma.marketingAutomationRule.findUnique({
      where: { id },
      select: {
        companyId: true,
        isPaused: true,
        isActive: true,
        date: true,
        startTime: true,
      },
    });

    if (!existingRule) {
      throw new NotFoundException(`Rule with id ${id} not found`);
    }

    // Handle createdBy if it's being updated to ensure it's never null/undefined
    const { target, attachments, ...restData } = updateMarketingRuleDto;
    const data = { ...restData };

    // if campaign is paused and being resumed, check the date and time
    const now = Date.now();
    const ruleDate = new Date(existingRule.date);
    const startTime = new Date(existingRule.startTime);
    // Combine date + time to get scheduled timestamp
    const scheduledDateTime = new Date(
      ruleDate.getFullYear(),
      ruleDate.getMonth(),
      ruleDate.getDate(),
      startTime.getHours(),
      startTime.getMinutes(),
      startTime.getSeconds(),
    ).getTime();
    const delay = Math.max(0, scheduledDateTime - now);

    if (
      existingRule?.isPaused == true &&
      data.isPaused == false &&
      existingRule.isActive == false
    ) {
      if (delay <= 0) {
        throw new HttpException(
          'Please update the campaign start date and then resume the rule',
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      data.isActive = true; // Automatically set to active when resuming
    }

    // Only include target if it's provided in the update
    if (target !== undefined) {
      data['target'] = JSON.stringify(target);
    }

    if (data.createdBy === undefined) {
      delete data.createdBy; // Remove if undefined to avoid updating it
    } else if (data.createdBy === null) {
      data.createdBy = 'system'; // Replace null with default value
    }

    if (data.startTime && data.date) {
      const date = moment(data.date);

      const timeObj = new Date(data.startTime);
      const hours = timeObj.getHours();
      const minutes = timeObj.getMinutes();
      const seconds = timeObj.getSeconds();

      // Set the time on the UTC date
      date.set({
        hour: hours,
        minute: minutes,
        second: seconds,
        millisecond: 0,
      });

      // Get the UTC ISO string
      const utcISO = date.toISOString();

      data.startTime = utcISO;
    }
    data.isPaused = data.isPaused ? data.isPaused : false;

    const result = await this.prisma.marketingAutomationRule.update({
      where: { id },
      data: {
        ...data,
        isActive: true,
      },
    });

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    if (existingRule) {
      await this.cacheManager.del(
        `${this.RULES_LIST_KEY}${existingRule.companyId}`,
      );
    }

    return result;
  }

  async findAllRules(companyId: number) {
    // Try to get from cache first using company-specific key
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(cachedKey);

    if (cachedRules) {
      return JSON.parse(cachedRules);
    }

    const rules = await this.prisma.marketingAutomationRule.findMany({
      where: { companyId },
      include: {
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform rules to parse JSON targetCondition
    const result = rules.map((rule) => ({
      ...rule,
      target:
        typeof rule.target === 'string' && rule.target
          ? JSON.parse(rule.target)
          : rule.target,
    }));

    // Save to cache with company-specific key
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000,
    );

    return result;
  }

  async findRuleById(id: number) {
    const cacheKey = `${this.RULE_CACHE_KEY}${id}`;
    const cachedRule = await this.cacheManager.get<string>(cacheKey);

    if (cachedRule) {
      return JSON.parse(cachedRule);
    }

    const rule = await this.prisma.marketingAutomationRule.findUnique({
      where: { id },
      include: {
        attachments: true,
      },
    });

    if (rule) {
      const parsedRule = {
        ...rule,
        target:
          typeof rule.target === 'string' && rule.target
            ? JSON.parse(rule.target)
            : rule.target,
      };

      // Save to cache
      await this.cacheManager.set(
        cacheKey,
        JSON.stringify(parsedRule),
        this.CACHE_TTL * 1000, // cache-manager will convert into milliseconds
      );

      return parsedRule;
    }

    return null;
  }

  async deleteRule(id: number) {
    // Get rule to find companyId before deleting
    const existingRule = await this.prisma.marketingAutomationRule.findUnique({
      where: { id },
      select: { companyId: true },
    });

    const result = await this.prisma.marketingAutomationRule.delete({
      where: { id },
    });

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);
    if (existingRule) {
      await this.cacheManager.del(
        `${this.RULES_LIST_KEY}${existingRule.companyId}`,
      );
    }

    return result;
  }

  async addAttachment(ruleId: number, fileUrl: string) {
    // Get rule to find companyId
    const rule = await this.prisma.marketingAutomationRule.findUnique({
      where: { id: ruleId },
      select: { companyId: true },
    });

    const result = await this.prisma.automationAttachment.create({
      data: {
        fileUrl,
        marketing: {
          connect: { id: ruleId },
        },
      },
    });

    // Invalidate caches
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${ruleId}`);
    if (rule) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
    }

    return result;
  }

  async removeAttachment(attachmentId: number) {
    // Get attachment with rule info
    const attachment = await this.prisma.automationAttachment.findUnique({
      where: { id: attachmentId },
      select: { marketingId: true },
    });

    // If we have the attachment, get the rule to find companyId
    let rule;
    if (attachment?.marketingId) {
      rule = await this.prisma.marketingAutomationRule.findUnique({
        where: { id: attachment.marketingId },
        select: { companyId: true },
      });
    }

    const result = await this.prisma.automationAttachment.delete({
      where: { id: attachmentId },
    });

    // Invalidate caches
    if (attachment?.marketingId) {
      await this.cacheManager.del(
        `${this.RULE_CACHE_KEY}${attachment.marketingId}`,
      );
      if (rule) {
        await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);
      }
    }

    return result;
  }
}
