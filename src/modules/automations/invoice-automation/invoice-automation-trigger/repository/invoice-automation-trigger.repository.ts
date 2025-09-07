import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InvoiceAutomationTriggerRepository {
  private readonly logger = new Logger(InvoiceAutomationTriggerRepository.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAllRule(companyId: number) {
    const result = await this.prisma.invoiceAutomationRule.findMany({
      where: {
        companyId,
      },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException('Invoice automation rules not found');
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
        `Invoice automation rule with ID ${ruleId} not found`,
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
