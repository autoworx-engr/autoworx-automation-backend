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

  @IsOptional()
  @IsString()
  timezone?: string;
}
