import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PipelineType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TagAutomationTriggerRepository {
  private readonly logger = new Logger(TagAutomationTriggerRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAllRule(companyId: number, pipelineType: PipelineType) {
    const result = await this.prisma.tagAutomationRule.findMany({
      where: {
        companyId: companyId,
        isPaused: false,
        pipelineType: pipelineType,
      },
      include: {
        tag: true,
        tagAutomationPipeline: true,
        tagAutomationCommunication: true,
        PostTagAutomationColumn: {
          include: { columnIds: true },
        },
      },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException('Tag automation rules not found');
    }

    return result;
  }

  async findRuleById(ruleId: number) {
    const result = await this.prisma.invoiceAutomationRule.findUnique({
      where: { id: ruleId },
      include: {
        attachments: true,
      },
    });

    if (!result) {
      throw new NotFoundException(
        `Tag automation rule with ID ${ruleId} not found`,
      );
    }

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
