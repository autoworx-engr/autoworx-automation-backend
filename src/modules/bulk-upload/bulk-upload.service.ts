import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { BulkUploadProcessorFactory } from './factories/bulk-upload-processor.factory';
import { BulkUploadDto, RowData, ProcessingResult } from './dto/bulk-upload.dto';

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(
    private readonly processorFactory: BulkUploadProcessorFactory,
  ) {}

  /**
   * Process bulk upload from Excel/CSV file
   * @param file Uploaded file buffer
   * @param uploadDto Upload metadata (companyId and type)
   * @returns Processing result with success/failure counts
   */
  async processBulkUpload(
    file: Express.Multer.File,
    uploadDto: BulkUploadDto,
  ): Promise<ProcessingResult> {
    try {
      this.logger.log(`Processing bulk upload - companyId: ${uploadDto.companyId}, type: ${uploadDto.type}`);
      
      // Parse the file
      const data = this.parseFile(file);
      this.logger.log(`Parsed ${data.length} rows from file`);

      // Validate that we have data
      if (data.length === 0) {
        throw new BadRequestException('File contains no data');
      }

      // Get the appropriate processor based on type
      const processor = this.processorFactory.getProcessor(uploadDto.type);
      this.logger.log(`Using processor for type: ${uploadDto.type}`);

      // Process the data
      const result = await processor.process(data, uploadDto.companyId);
      this.logger.log(`Processing complete - Success: ${result.successfulRows}, Failed: ${result.failedRows}`);

      return result;
    } catch (error) {
      this.logger.error(`Bulk upload processing error: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to process bulk upload: ${error.message}`,
      );
    }
  }

  /**
   * Parse Excel or CSV file and extract row data
   * @param file Uploaded file
   * @returns Array of parsed row data
   */
  private parseFile(file: Express.Multer.File): RowData[] {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as any[][];

      const data: RowData[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        if (!row || row.length === 0 || !row[0]) {
          continue;
        }

        // Parse row data - handles both service and labor formats
        data.push({
          name: String(row[0] || '').trim(),
          category: String(row[1] || '').trim(),
          tags: row[2] ? String(row[2]).trim() : undefined,
          notes: row[3] ? String(row[3]).trim() : undefined,
          hours: row[4] ? row[4] : undefined,
          charge: row[5] ? row[5] : undefined,
          discount: row[6] ? row[6] : undefined,
          description: row[2] ? String(row[2]).trim() : undefined, // For service compatibility
        });
      }

      return data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse file: ${error.message}`,
      );
    }
  }
}
