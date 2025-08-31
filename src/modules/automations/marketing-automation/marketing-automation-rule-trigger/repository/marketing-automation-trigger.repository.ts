import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MarketingAutomationTriggerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllRule(companyId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await this.prisma.marketingAutomationRule.findMany({
      where: {
        isPaused: false,
        isActive: true,
        ...(companyId !== undefined && { companyId }),
        startTime: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  async findRuleById(ruleId: number) {
    return await this.prisma.marketingAutomationRule.findUnique({
      where: { id: ruleId },
      include: {
        attachments: {
          select: {
            fileUrl: true,
          },
        },
      },
    });
  }

  async updateRule(
    ruleId: number,
    payload: { isActive?: boolean; isPaused?: boolean },
  ) {
    const result = await this.prisma.marketingAutomationRule.update({
      where: { id: ruleId },
      data: payload,
    });

    return result;
  }

  async findAllClientsByCompanyId(companyId: number, targetCondition: string) {
    const now = new Date();

    const subtractMonths = (months: number) => {
      const d = new Date();
      d.setMonth(d.getMonth() - months);
      return d;
    };

    let dateFilter: any = {};

    switch (targetCondition) {
      case 'ALL_CLIENTS_THIS_MONTH':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        };
        break;

      case 'ALL_CLIENTS_THIS_YEAR':
        dateFilter = {
          gte: new Date(now.getFullYear(), 0, 1),
          lt: new Date(now.getFullYear() + 1, 0, 1),
        };

        break;

      case 'ALL_CLIENTS_FROM_1_MONTH':
        dateFilter = {
          gte: subtractMonths(1),
        };
        break;

      case 'ALL_CLIENTS_FROM_2_MONTHS':
        dateFilter = {
          gte: subtractMonths(2),
        };
        break;

      case 'ALL_CLIENTS_FROM_3_MONTHS':
        dateFilter = {
          gte: subtractMonths(3),
        };
        break;

      case 'ALL_CLIENTS_FROM_6_MONTHS':
        dateFilter = {
          gte: subtractMonths(6),
        };
        break;

      case 'ALL_CLIENTS_FROM_LAST_YEAR':
        dateFilter = {
          gte: new Date(now.getFullYear() - 1, 0, 1),
          lt: new Date(now.getFullYear(), 0, 1),
        };
        break;

      default:
        dateFilter = {}; // no filtering
    }

    const allClient = await this.prisma.client.findMany({
      where: {
        companyId,
        isFleet: false,
        ...(targetCondition ? { createdAt: dateFilter } : {}),
      },
      include: {
        Vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
          },
        },

        company: true,
        appointments: true,
        Invoice: {
          select: {
            type: true,
          },
        },
        Lead: true,
      },
    });

    return allClient;
  }

  async findClientById(clientId: number) {
    return await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        Vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
          },
        },
        company: true,
        appointments: true,
        Invoice: {
          select: {
            type: true,
          },
        },
        Lead: true,
      },
    });
  }
}
