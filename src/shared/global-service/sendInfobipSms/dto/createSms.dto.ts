import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInfobipSmsDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  message: string;

  @IsString()
  to: string;

  @IsNumber()
  clientId: number;

  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsNumber()
  companyId: number;

  @IsArray()
  @IsOptional()
  attachments?: string[];
}
