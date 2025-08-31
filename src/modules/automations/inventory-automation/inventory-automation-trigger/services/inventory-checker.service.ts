import { Injectable } from '@nestjs/common';
import { InventoryCondition } from '@prisma/client';
import {
  InventoryCheckResult,
  LowStockProduct,
  OutOfStockProduct,
} from '../interfaces/inventory-trigger.interface';
import { InventoryTriggerRepository } from '../repositories/inventory-trigger.repository';

@Injectable()
export class InventoryCheckerService {
  constructor(
    private readonly inventoryRepository: InventoryTriggerRepository,
  ) {}

  /**
   * Check inventory conditions for a specific company
   */
  async checkInventoryConditions(
    companyId: number,
    condition: InventoryCondition,
  ): Promise<InventoryCheckResult> {
    const inventoryProducts =
      await this.inventoryRepository.getInventoryProducts(companyId);

    const lowStockProducts: LowStockProduct[] = [];
    const outOfStockProducts: OutOfStockProduct[] = [];

    for (const product of inventoryProducts) {
      const currentQuantity = Number(product.quantity || 0);
      const lowStockThreshold = product.lowInventoryAlert || 0;

      // Check based on the specific condition requested
      const shouldCheckOutOfStock =
        condition === InventoryCondition.OUT_OF_STOCK ||
        condition === InventoryCondition.BOTH;
      const shouldCheckLowStock =
        condition === InventoryCondition.LOW_STOCK ||
        condition === InventoryCondition.BOTH;

      // Check if product is out of stock (quantity is 0 or less)
      if (shouldCheckOutOfStock && currentQuantity <= 0) {
        outOfStockProducts.push({
          id: product.id,
          name: product.name,
          unit: product.unit || 'pc',
        });
      }
      // Check if product is low in stock (quantity > 0 but <= threshold)
      // Important: Only check low stock if quantity > 0 (not out of stock)
      if (
        shouldCheckLowStock &&
        lowStockThreshold > 0 &&
        currentQuantity > 0 &&
        currentQuantity <= lowStockThreshold
      ) {
        lowStockProducts.push({
          id: product.id,
          name: product.name,
          currentQuantity,
          lowStockThreshold,
          unit: product.unit || 'pc',
        });
      }
    }

    return {
      lowStockProducts,
      outOfStockProducts,
      hasLowStock: lowStockProducts.length > 0,
      hasOutOfStock: outOfStockProducts.length > 0,
    };
  }

  /**
   * Check if the condition matches the current inventory state
   */
  shouldTriggerNotification(
    condition: InventoryCondition,
    checkResult: InventoryCheckResult,
  ): boolean {
    switch (condition) {
      case InventoryCondition.LOW_STOCK:
        return checkResult.hasLowStock;
      case InventoryCondition.OUT_OF_STOCK:
        return checkResult.hasOutOfStock;
      case InventoryCondition.BOTH:
        return checkResult.hasLowStock || checkResult.hasOutOfStock;
      default:
        return false;
    }
  }

  /**
   * Generate the message content for notifications
   */
  generateNotificationMessage(
    checkResult: InventoryCheckResult,
    condition: InventoryCondition,
  ): string {
    let message = 'You are running out of stocks for below products:\n\n';
    let productCount = 1;

    // Add out of stock products
    if (
      (condition === InventoryCondition.OUT_OF_STOCK ||
        condition === InventoryCondition.BOTH) &&
      checkResult.hasOutOfStock
    ) {
      message += 'OUT OF STOCK:\n';
      for (const product of checkResult.outOfStockProducts) {
        message += `${productCount}. ${product.name} → 0 ${product.unit}\n`;
        productCount++;
      }
      message += '\n';
    }

    // Add low stock products
    if (
      (condition === InventoryCondition.LOW_STOCK ||
        condition === InventoryCondition.BOTH) &&
      checkResult.hasLowStock
    ) {
      message += 'LOW STOCK:\n';
      for (const product of checkResult.lowStockProducts) {
        message += `${productCount}. ${product.name} → ${product.currentQuantity} ${product.unit} (Threshold: ${product.lowStockThreshold})\n`;
        productCount++;
      }
    }

    return message.trim();
  }
}
