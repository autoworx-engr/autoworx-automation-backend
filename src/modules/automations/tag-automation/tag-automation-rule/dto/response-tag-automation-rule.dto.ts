import { ApiProperty } from '@nestjs/swagger';
import { ConditionType, PipelineType, TagRuleType } from '@prisma/client';

export class ResponseTagAutomationRuleDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Tag Follow Up' })
  title: string;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({ example: 0 })
  timeDelay: number;

  @ApiProperty({ enum: ConditionType })
  conditionType: ConditionType;

  @ApiProperty({ enum: PipelineType })
  pipelineType: PipelineType;

  @ApiProperty({ enum: TagRuleType, required: false })
  ruleType?: TagRuleType;

  @ApiProperty({ type: [Number], example: [1, 2] })
  tagIds: number[];

  @ApiProperty({ type: [Number], example: [1, 2] })
  columnIds: number[];

  @ApiProperty({ example: '2025-11-04T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-04T12:00:00Z' })
  updatedAt: Date;
}
