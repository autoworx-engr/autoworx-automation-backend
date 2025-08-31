import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommunicationType } from '@prisma/client';
import { CreateMarketingRuleDto } from '../dto/create-marketing-rule.dto';
import { UpdateMarketingRuleDto } from '../dto/update-marketing-rule.dto';
import { MarketingAutomationRuleRepository } from '../repositories/marketing-automation-rule.repository';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class MarketingAutomationRuleService {
  private readonly logger = new Logger(MarketingAutomationRuleService.name);
  private readonly RULE_CACHE_KEY = 'marketing_automation_rule:';
  private readonly RULES_LIST_KEY = 'marketing_automation_rules:list:';

  private readonly CACHE_TTL = 15 * 24 * 3600; // 1 hour in seconds
  constructor(
    private readonly marketingRuleRepository: MarketingAutomationRuleRepository,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  // Add this method to handle attachments during rule creation
  async create(createMarketingRuleDto: CreateMarketingRuleDto) {
    // Extract attachments if they exist
    const { attachments, ...ruleData } = createMarketingRuleDto;

    // Validate required fields based on communication and template types
    this.validateRuleData(ruleData);

    // Create the rule using repository
    const createdRule = await this.marketingRuleRepository.createRule(ruleData);

    // Add attachments if provided
    if (attachments && Array.isArray(attachments)) {
      for (const fileUrl of attachments) {
        await this.marketingRuleRepository.addAttachment(
          createdRule.id,
          fileUrl,
        );
      }
    }

    // Invalidate the rules list cache for the company
    await this.cacheManager.del(
      `${this.RULES_LIST_KEY}${createMarketingRuleDto.companyId}`,
    );

    return this.findOne(createdRule.id);
  }

  async findAll(companyId: number) {
    const cachedKey = `${this.RULES_LIST_KEY}${companyId}`;
    const cachedRules = await this.cacheManager.get<string>(cachedKey);
    const rules = await this.marketingRuleRepository.findAllRules(companyId);
    if (cachedRules) {
      return JSON.parse(cachedRules);
    }

    const result = rules.map((rule) => this.formatRuleResponse(rule));
    await this.cacheManager.set(
      cachedKey,
      JSON.stringify(rules),
      this.CACHE_TTL * 1000, // cache-manager uses milliseconds
    );

    return result;
  }

  async findOne(id: number) {
    const rule = await this.marketingRuleRepository.findRuleById(id);

    if (!rule) {
      throw new NotFoundException(`Marketing rule with ID ${id} not found`);
    }

    return this.formatRuleResponse(rule);
  }

  async update(id: number, updateMarketingRuleDto: UpdateMarketingRuleDto) {
    // Check if rule exists
    const existingRule = await this.marketingRuleRepository.findRuleById(id);

    if (!existingRule) {
      throw new NotFoundException(`Marketing rule with ID ${id} not found`);
    }

    if (typeof existingRule === 'string') {
      throw new Error('Invalid rule data: Expected object but got string');
    }
    // Extract attachments if they exist
    const { attachments, ...ruleData } = updateMarketingRuleDto;

    // If there are fields to validate in the update DTO, validate them
    if (Object.keys(ruleData).length > 0) {
      this.validateRuleData({ ...existingRule, ...ruleData });
    }

    // Update the rule using repository
    await this.marketingRuleRepository.updateRule(id, ruleData);

    // Handle attachments if provided
    if (attachments && Array.isArray(attachments)) {
      // You may want to delete existing attachments first
      if (existingRule.attachments) {
        for (const attachment of existingRule.attachments) {
          await this.marketingRuleRepository.removeAttachment(attachment.id);
        }
      }

      // Add new attachments
      for (const fileUrl of attachments) {
        await this.marketingRuleRepository.addAttachment(id, fileUrl);
      }
    }

    // Invalidate the rules list cache for the company
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${id}`);

    if (existingRule.companyId) {
      await this.cacheManager.del(
        `${this.RULES_LIST_KEY}${existingRule.companyId}`,
      );
    }

    // Fetch and return the updated rule
    return this.findOne(id);
  }

  async remove(id: number) {
    const rule = await this.marketingRuleRepository.findRuleById(id);

    if (!rule) {
      throw new NotFoundException(`Marketing rule with ID ${id} not found`);
    }

    // Delete the rule using repository
    await this.marketingRuleRepository.deleteRule(id);

    // Invalidate the rules list cache for the company
    await this.cacheManager.del(`${this.RULES_LIST_KEY}${rule.companyId}`);

    return { id, message: 'Marketing rule deleted successfully' };
  }

  private validateRuleData(ruleData: any) {
    // For EMAIL type, emailSubject and emailBody are required
    if (
      (ruleData.communicationType === CommunicationType.EMAIL ||
        ruleData.communicationType === CommunicationType.BOTH) &&
      (!ruleData.emailSubject || !ruleData.emailBody)
    ) {
      throw new BadRequestException(
        'Email subject and body are required for EMAIL and BOTH communication types',
      );
    }

    // For SMS type, smsBody is required
    if (
      (ruleData.communicationType === CommunicationType.SMS ||
        ruleData.communicationType === CommunicationType.BOTH) &&
      !ruleData.smsBody
    ) {
      throw new BadRequestException(
        'SMS body is required for SMS and BOTH communication types',
      );
    }
  }

  private formatRuleResponse(rule: any) {
    return {
      id: rule.id,
      companyId: rule.companyId,
      target: rule.target,
      targetCondition: rule.targetCondition,
      date: rule.date,
      startTime: rule.startTime,
      endTime: rule.endTime,
      isAppointmentCreated: rule.isAppointmentCreated,
      vehicleMinYear: rule.vehicleMinYear,
      vehicleMaxYear: rule.vehicleMaxYear,
      vehicleBrand: rule.vehicleBrand,
      vehicleModel: rule.vehicleModel,
      communicationType: rule.communicationType,
      emailSubject: rule.emailSubject,
      emailBody: rule.emailBody,
      smsBody: rule.smsBody,
      isPaused: rule.isPaused,
      createdBy: rule.createdBy,
      attachments:
        rule.attachments?.map((attachment) => ({
          id: attachment.id,
          fileUrl: attachment.fileUrl,
        })) || [],
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
