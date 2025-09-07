// import { ApiProperty } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { ConditionType } from '@prisma/client';

export class PipelineStageDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  columnId: number;

  @ApiProperty({ example: 'New Lead' })
  columnTitle?: string;
}

export class ResponsePipelineRuleDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Lead Nurture' })
  title: string;

  @ApiProperty({ type: [PipelineStageDto] })
  stages: PipelineStageDto[];

  @ApiProperty({
    enum: ConditionType,
    example: ConditionType.APPOINTMENT_SCHEDULED,
  })
  conditionType: ConditionType;

  @ApiProperty({ example: 2, nullable: true })
  targetColumnId: number | null;

  @ApiProperty({ example: 'Qualified Lead', nullable: true })
  targetColumnTitle?: string | null;

  @ApiProperty({ example: false })
  isPaused: boolean;

  @ApiProperty({ example: 2, nullable: true })
  timeDelay: number | null;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({ example: '2025-05-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-05-01T12:00:00Z' })
  updatedAt: Date;
}
