import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTagAutomationTriggerDto {
  @ApiProperty({
    description: 'This is company ID',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'Company ID must be a number' })
  companyId: number;

  @ApiProperty({
    description: 'This is lead ID',
    example: '13489758',
    type: String,
    required: true,
  })
  @IsNumber({}, { message: 'Lead Id must be a number' })
  leadId: number;

  @ApiProperty({
    description: 'This is column ID',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'Column Id must be a number' })
  columnId: number;
}
