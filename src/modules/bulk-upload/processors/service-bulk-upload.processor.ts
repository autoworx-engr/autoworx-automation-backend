import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IBulkUploadProcessor } from '../interfaces/bulk-upload-processor.interface';
import { RowData, ProcessingResult } from '../dto/bulk-upload.dto';

@Injectable()
export class ServiceBulkUploadProcessor implements IBulkUploadProcessor {
  private readonly logger = new Logger(ServiceBulkUploadProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(data: RowData[], companyId: number): Promise<ProcessingResult> {
    this.logger.log(`Service bulk upload - checking company ${companyId}`);
    
    // Verify company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      this.logger.error(`Company not found: ${companyId}`);
      throw new Error('Company not found');
    }
    
    this.logger.log(`Company ${companyId} verified, processing ${data.length} rows`);

    const result: ProcessingResult = {
      totalRows: data.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
    };

    const categoryCache = new Map<string, number>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; 
      try {
        if (!row.name || !row.category) {
          throw new Error('Name and category are required fields');
        }

        let categoryId: number;
        const categoryKey = `${row.category.toLowerCase()}_${companyId}`;

        if (categoryCache.has(categoryKey)) {
          categoryId = categoryCache.get(categoryKey)!;
        } else {
          let category = await this.prisma.category.findFirst({
            where: {
              name: row.category,
              companyId: companyId,
            },
          });

          if (!category) {
            category = await this.prisma.category.create({
              data: {
                name: row.category,
                companyId: companyId,
              },
            });
          }

          categoryId = category.id;
          categoryCache.set(categoryKey, categoryId);
        }

        // Create service
        await this.prisma.service.create({
          data: {
            name: row.name.trim(),
            categoryId: categoryId,
            description: row.description?.trim() || null,
            canned: true,
            companyId: companyId,
          },
        });

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
}
