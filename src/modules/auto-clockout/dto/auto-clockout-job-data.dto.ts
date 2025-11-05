import { Optional } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class AutoClockOutJobDataDto {
  @IsInt()
  clockInOutId: number;

  @IsInt()
  userId: number;

  @IsInt()
  companyId: number;

  @IsDateString()
  clockIn: string;

  @IsDateString()
  @Optional()
  officeEnd: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
