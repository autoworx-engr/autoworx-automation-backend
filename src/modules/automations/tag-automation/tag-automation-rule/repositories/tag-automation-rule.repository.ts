import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';

@Injectable()
export class TagAutomationRuleRepository {
  private readonly logger = new Logger(TagAutomationRuleRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly RULE_CACHE_KEY = 'tag_automation_rule:';
  private readonly RULES_LIST_KEY = 'tag_automation_rules:list:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  // async createRule(createDto: CreateTagAutomationRuleDto) {
  //   const { tagIds, columnIds, ...ruleData } = createDto;
  //   const rule = await this.prisma.tagAutomationRule.create({
  //     data: {
  //       ...ruleData,
  //       tag: { connect: tagIds.map((id) => ({ id })) },
  //       columns: { connect: columnIds.map((id) => ({ id })) }, // ✅ fixed here
  //     },
  //   });
  //   return rule;
  // }

  async createRule(createDto: CreateTagAutomationRuleDto) {
    const { tagIds, columnIds, ...ruleData } = createDto;

    const rule = await this.prisma.tagAutomationRule.create({
      data: {
        ...ruleData,
        tag: { connect: tagIds.map((id) => ({ id })) },
        PostTagAutomationColumn: {
          create: columnIds.length
            ? [
                {
                  columnIds: {
                    connect: columnIds.map((id) => ({ id })),
                  },
                },
              ]
            : [],
        },
      },
      include: {
        tag: true,
        PostTagAutomationColumn: {
          include: { columnIds: true },
        },
      },
    });

    return rule;
  }

  async findAllRules(companyId: number) {
    return this.prisma.tagAutomationRule.findMany({
      where: { companyId },
      include: {
        tag: true,
        // columns: true,
        PostTagAutomationColumn: {
          include: { columnIds: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleById(id: number) {
    return this.prisma.tagAutomationRule.findUnique({
      where: { id },
      include: {
        tag: true,
        // columns: true,
        PostTagAutomationColumn: {
          include: { columnIds: true },
        },
      },
    });
  }

  async updateRule(id: number, updateDto: UpdateTagAutomationRuleDto) {
    const { tagIds, columnIds, ...ruleData } = updateDto;
    return this.prisma.tagAutomationRule.update({
      where: { id },
      data: {
        ...ruleData,
        ...(tagIds ? { tag: { set: tagIds.map((id) => ({ id })) } } : {}),
        ...(columnIds
          ? // ? { columns: { set: columnIds.map((id) => ({ id })) } }
            {
              PostTagAutomationColumn: {
                deleteMany: {}, // remove old column links
                create: [
                  {
                    columnIds: {
                      connect: columnIds.map((id) => ({ id })),
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        tag: true,
        PostTagAutomationColumn: { include: { columnIds: true } },
      },
    });
  }

  async deleteRule(id: number) {
    return this.prisma.tagAutomationRule.delete({
      where: { id },
    });
  }
}
