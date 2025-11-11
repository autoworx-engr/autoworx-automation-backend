import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PipelineType, TagConditionType } from '@prisma/client';

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
    type: Number,
    required: false,
  })
  @IsNumber({}, { message: 'Lead Id must be a number' })
  @IsOptional()
  leadId: number;

  @ApiProperty({
    description: 'This is invoice ID',
    example: '13489758',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  invoiceId: string;

  @ApiProperty({
    description: 'This is column ID',
    example: 1,
    type: Number,
    required: false,
  })
  @IsNumber({}, { message: 'Column Id must be a number' })
  @IsOptional()
  columnId: number;

  @ApiProperty({
    description: 'This is tag ID',
    example: 1,
    type: Number,
    required: false,
  })
  @IsNumber({}, { message: 'Tag Id must be a number' })
  @IsOptional()
  tagId: number;

  @ApiProperty({ enum: PipelineType, example: 'SALES' })
  @IsEnum(PipelineType)
  pipelineType: PipelineType;

  @ApiProperty({ enum: TagConditionType, example: 'pipeline' })
  @IsEnum(TagConditionType)
  @IsOptional()
  conditionType: TagConditionType;
}
