import { IsNumber, IsString } from 'class-validator';

export class CreateSmsDto {
  @IsString()
  phoneNumber: string;
  @IsString()
  message: string;
  @IsString()
  to: string;
  @IsNumber()
  clientId: number;
  @IsNumber()
  userId: number;
  @IsNumber()
  companyId: number;
}
