import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class UpdateServiceAutomationTriggerDto {
  @ApiProperty({
    description: 'Company ID to which the service automation rule belongs',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'companyId must be a number' })
  companyId: number;

  @ApiProperty({
    description: 'Estimate ID to which the service automation rule belongs',
    example: '1',
    type: String,
    required: true,
  })
  @IsString({ message: 'estimateId must be a string' })
  estimateId: string;

  @ApiProperty({
    description: 'Column ID to which the service automation rule belongs',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'conditionColumnId must be a number' })
  columnId: number;
}
