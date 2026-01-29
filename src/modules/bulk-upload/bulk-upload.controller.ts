import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadDto, ProcessingResult } from './dto/bulk-upload.dto';

@ApiTags('Bulk Upload')
@Controller('bulk-upload')
export class BulkUploadController {
  private readonly logger = new Logger(BulkUploadController.name);

  constructor(private readonly bulkUploadService: BulkUploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload Excel/CSV file for bulk service or labor creation' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel or CSV file',
        },
        companyId: {
          type: 'integer',
          description: 'Company ID',
          example: 12,
        },
        type: {
          type: 'string',
          enum: ['service', 'labor'],
          description: 'Type of upload',
          example: 'service',
        },
      },
      required: ['file', 'companyId', 'type'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File processed successfully',
    schema: {
      type: 'object',
      properties: {
        totalRows: { type: 'number', example: 100 },
        successfulRows: { type: 'number', example: 95 },
        failedRows: { type: 'number', example: 5 },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number', example: 10 },
              error: { type: 'string', example: 'Name and category are required fields' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid file or parameters' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId', ParseIntPipe) companyId: number,
    @Body('type') type: string,
  ): Promise<ProcessingResult> {
    try {
      this.logger.log(`Bulk upload request - companyId: ${companyId}, type: ${type}`);
      
      if (!file) {
        throw new BadRequestException('File is required');
      }
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed',
        );
      }

      const uploadDto: BulkUploadDto = {
        companyId,
        type: type as any,
      };

      return await this.bulkUploadService.processBulkUpload(file, uploadDto);
    } catch (error) {
      this.logger.error(`Bulk upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
