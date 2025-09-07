import { ApiProperty } from '@nestjs/swagger';
import { ConditionType } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsString, ValidateIf } from 'class-validator';

export class CreatePipelineRuleDto {
  @ApiProperty({
    description: 'Title of the automation rule',
    example: 'Lead Nurture',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Array of stage/column IDs where the rule should be applied',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @IsInt({ each: true })
  stageIds: number[];

  @ApiProperty({
    description: 'Condition that triggers the automation',
    enum: ConditionType,
    example: ConditionType.APPOINTMENT_SCHEDULED,
  })
  @IsEnum(ConditionType)
  conditionType: ConditionType;

  @ApiProperty({
    description:
      'Target column/stage ID where the lead will be moved (required for MOVE_TO_STAGE action)',
    example: 4,
    required: false,
  })
  @IsInt()
  targetColumnId?: number;

  @ApiProperty({
    description: 'Time delay value (required for TIME_DELAY condition)',
    example: 2,
    required: false,
  })
  @ValidateIf((o) => o.conditionType === ConditionType.TIME_DELAY)
  @IsInt()
  timeDelay?: number;

  @ApiProperty({ description: 'Company ID', example: 1 })
  @IsInt()
  companyId: number;
}
