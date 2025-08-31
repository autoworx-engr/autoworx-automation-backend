import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryAutomationFrequency, DayOfWeek } from '@prisma/client';
import { InventoryProductInfo } from '../interfaces/inventory-trigger.interface';

@Injectable()
export class InventoryTriggerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get inventory products for a specific company
   */
  async getInventoryProducts(
    companyId: number,
  ): Promise<InventoryProductInfo[]> {
    const products = await this.prisma.inventoryProduct.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        lowInventoryAlert: true,
        unit: true,
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      quantity: Number(product.quantity || 0),
      lowInventoryAlert: product.lowInventoryAlert || 0,
      unit: product.unit || 'pc',
    }));
  }

  /**
   * Get inventory automation rules by frequency
   */
  async getRulesByFrequency(
    frequency: InventoryAutomationFrequency,
    day?: DayOfWeek,
  ) {
    const whereClause: any = {
      frequency,
      isPaused: false,
    };

    // For weekly frequency, we must have a day to filter by
    if (frequency === InventoryAutomationFrequency.WEEKLY) {
      if (day) {
        whereClause.day = day;
      } else {
        // If no day is provided for weekly frequency, return empty result
        // This is a defensive measure - weekly rules should always have a day
        return [];
      }
    }

    return await this.prisma.inventoryAutomationRule.findMany({
      where: whereClause,
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get a specific inventory automation rule with team members
   */
  async getRuleById(ruleId: number) {
    return await this.prisma.inventoryAutomationRule.findUnique({
      where: { id: ruleId },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get every-two-months rules that should run today based on their creation date
   * Only runs on the 1st of the month and calculates intervals from rule creation
   */
  async getEveryTwoMonthsRulesForToday() {
    const today = new Date();

    // Only check on the 1st of the month
    if (today.getDate() !== 1) {
      return [];
    }

    // Get all active every-two-months rules
    const rules = await this.prisma.inventoryAutomationRule.findMany({
      where: {
        frequency: InventoryAutomationFrequency.EVERY_TWO_MONTHS,
        isPaused: false,
      },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Filter rules that should run today based on their creation date
    const rulesToRun = rules.filter((rule) => {
      const createdDate = new Date(rule.createdAt);
      const createdMonth = createdDate.getMonth(); // 0-based (0=Jan, 11=Dec)
      const createdYear = createdDate.getFullYear();

      const currentMonth = today.getMonth(); // 0-based
      const currentYear = today.getFullYear();

      // Calculate months elapsed since creation
      const monthsElapsed =
        (currentYear - createdYear) * 12 + (currentMonth - createdMonth);

      // Rule should run if:
      // 1. It's exactly 0, 2, 4, 6, 8... months after creation
      // 2. monthsElapsed must be >= 0 (can't run before creation)
      return monthsElapsed >= 0 && monthsElapsed % 2 === 0;
    });

    return rulesToRun;
  }
}
