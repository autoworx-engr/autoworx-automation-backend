import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IBulkUploadProcessor } from '../interfaces/bulk-upload-processor.interface';
import { RowData, ProcessingResult } from '../dto/bulk-upload.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class LaborBulkUploadProcessor implements IBulkUploadProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async process(data: RowData[], companyId: number): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      totalRows: data.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
    };

    const categoryCache = new Map<string, number>();
    const tagCache = new Map<string, number>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;
      try {
        if (!row.name || !row.hours || !row.charge) {
          throw new Error('Name, hours, and charge are required fields');
        }

        const hours = this.parseDecimal(row.hours, 'hours');
        const charge = this.parseDecimal(row.charge, 'charge');
        const discount = row.discount ? this.parseDecimal(row.discount, 'discount') : null;

        let categoryId: number | null = null;
        if (row.category && row.category.trim()) {
          categoryId = await this.getOrCreateCategoryId(
            row.category,
            companyId,
            categoryCache,
          );
        }

        const tagIds: number[] = [];
        if (row.tags && row.tags.trim()) {
          const tagNames = row.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

          for (const tagName of tagNames) {
            const tagId = await this.getOrCreateTagId(
              tagName,
              companyId,
              tagCache,
            );
            tagIds.push(tagId);
          }
        }

        const labor = await this.prisma.labor.create({
          data: {
            name: row.name.trim(),
            categoryId: categoryId,
            notes: row.notes?.trim() || null,
            hours: hours,
            charge: charge,
            discount: discount,
            cannedLabor: true,
            companyId: companyId,
          },
        });

        if (tagIds.length > 0) {
          await this.prisma.laborTag.createMany({
            data: tagIds.map((tagId) => ({
              laborId: labor.id,
              tagId: tagId,
            })),
          });
        }

        result.successfulRows++;
      } catch (error) {
        result.failedRows++;
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
          data: row,
        });
      }
    }

    return result;
  }

  /**
   * Get or create category and return its ID
   */
  private async getOrCreateCategoryId(
    categoryName: string,
    companyId: number,
    cache: Map<string, number>,
  ): Promise<number> {
    const categoryKey = `${categoryName.toLowerCase()}_${companyId}`;

    if (cache.has(categoryKey)) {
      return cache.get(categoryKey)!;
    }

    let category = await this.prisma.category.findFirst({
      where: {
        name: categoryName,
        companyId: companyId,
      },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: categoryName,
          companyId: companyId,
        },
      });
    }

    cache.set(categoryKey, category.id);
    return category.id;
  }

  /**
   * Get or create tag and return its ID
   */
  private async getOrCreateTagId(
    tagName: string,
    companyId: number,
    cache: Map<string, number>,
  ): Promise<number> {
    const tagKey = `${tagName.toLowerCase()}_${companyId}`;

    if (cache.has(tagKey)) {
      return cache.get(tagKey)!;
    }

    let tag = await this.prisma.tag.findFirst({
      where: {
        name: tagName,
        companyId: companyId,
        type: 'GENERAL', // Labor tags are GENERAL type
      },
    });

    if (!tag) {
      tag = await this.prisma.tag.create({
        data: {
          name: tagName,
          companyId: companyId,
          type: 'GENERAL',
          textColor: '#000000', // Default black text
          bgColor: '#E5E7EB', // Default light gray background
        },
      });
    }

    cache.set(tagKey, tag.id);
    return tag.id;
  }

  /**
   * Parse string or number to Decimal
   */
  private parseDecimal(value: string | number, fieldName: string): Decimal {
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        throw new Error(`Invalid ${fieldName} value`);
      }
      return new Decimal(numValue);
    } catch (error) {
      throw new Error(`Invalid ${fieldName}: ${value}`);
    }
  }
}
