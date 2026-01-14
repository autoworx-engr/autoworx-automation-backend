import { IsInt, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UploadType {
  SERVICE = 'service',
  LABOR = 'labor',
}

export class BulkUploadDto {
  @ApiProperty({ description: 'Company ID', example: 12 })
  @IsInt()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({ description: 'Type of upload', enum: UploadType, example: 'service' })
  @IsEnum(UploadType)
  @IsNotEmpty()
  type: UploadType;
}

export interface RowData {
  name: string;
  category: string;
  description?: string;
  // Labor-specific fields
  tags?: string;
  notes?: string;
  hours?: string | number;
  charge?: string | number;
  discount?: string | number;
}

export interface ProcessingResult {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}
