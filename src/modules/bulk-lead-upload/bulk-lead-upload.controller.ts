import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkLeadUploadService } from './bulk-lead-upload.service';
import { BulkLeadUploadResponseDto } from './dto/create-bulk-lead-upload.dto';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';

@ApiTags('Bulk Lead Upload')
@Controller('bulk-lead-upload')
export class BulkLeadUploadController {
  constructor(private readonly bulkLeadUploadService: BulkLeadUploadService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload CSV or Excel file with leads' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        companyId: {
          type: 'number',
        },
        columnId: {
          type: 'number',
          description: 'Pipeline column/stage ID',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId') companyId: string,
    @Body('columnId') columnId?: string,
  ): Promise<BulkLeadUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!companyId) {
      throw new BadRequestException('Company ID is required');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only CSV and Excel files are allowed',
      );
    }

    return this.bulkLeadUploadService.processFile(
      file,
      parseInt(companyId),
      columnId ? parseInt(columnId) : undefined,
    );
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get upload job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.bulkLeadUploadService.getJobStatus(jobId);
  }
}
