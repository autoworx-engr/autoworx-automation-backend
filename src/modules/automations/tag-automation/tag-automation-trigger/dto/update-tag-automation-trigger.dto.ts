import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PipelineType, TagConditionType } from '@prisma/client';

export class UpdateTagAutomationTriggerDto {
  @ApiProperty({
    description: 'Company ID',
    example: 1,
    type: Number,
  })
  @IsNumber({}, { message: 'companyId must be a number' })
  companyId: number;

  @ApiProperty({
    description: 'Lead ID (optional)',
    example: 13489758,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'leadId must be a number' })
  leadId?: number;

  @ApiProperty({
    description: 'Invoice ID (optional)',
    example: 987654,
    type: String,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'invoiceId must be a number' })
  invoiceId?: string;

  @ApiProperty({
    description: 'Column ID (optional)',
    example: 2,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'columnId must be a number' })
  columnId?: number;

  @ApiProperty({
    description: 'Tag ID (optional)',
    example: 4,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'tagId must be a number' })
  tagId?: number;

  @ApiProperty({
    description: 'Pipeline Type',
    enum: PipelineType,
    example: PipelineType.SALES,
  })
  @IsEnum(PipelineType, { message: 'pipelineType must be a valid enum value' })
  pipelineType: PipelineType;

  @ApiProperty({
    description: 'Condition Type (optional)',
    enum: TagConditionType,
    example: TagConditionType.post_tag,
    required: false,
  })
  @IsOptional()
  @IsEnum(TagConditionType, {
    message: 'conditionType must be a valid enum value',
  })
  conditionType?: TagConditionType;
}
