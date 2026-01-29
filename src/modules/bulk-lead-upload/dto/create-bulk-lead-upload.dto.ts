import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class LeadRowDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  contact?: string; // Phone number

  @IsOptional()
  @IsString()
  vehicle?: string; // Format: year-make-model

  @IsNotEmpty()
  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  created_at?: string;
}

export class BulkLeadUploadResponseDto {
  jobId: string;
  message: string;
  totalRecords: number;
}
