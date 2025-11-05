import { ApiProperty } from '@nestjs/swagger';
import {
  CommunicationType,
  PipelineType,
  TagConditionType,
  TagRuleType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AutomationAttachmentDto } from 'src/modules/automations/communication-automation/communication-automation-rule/dto/automation-attachment.dto';

export class CreateTagAutomationRuleDto {
  @ApiProperty({ example: 'Tag Follow Up' })
  @IsString()
  title: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  companyId: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @IsOptional()
  timeDelay?: number;

  @ApiProperty({ enum: TagConditionType })
  @IsEnum(TagConditionType)
  condition_type: TagConditionType;

  @ApiProperty({ enum: PipelineType })
  @IsEnum(PipelineType)
  pipelineType: PipelineType;

  @ApiProperty({ enum: TagRuleType, required: false })
  @IsEnum(TagRuleType)
  @IsOptional()
  ruleType?: TagRuleType;

  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @IsInt({ each: true })
  tagIds: number[];

  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @IsInt({ each: true })
  columnIds: number[];

  @ApiProperty({
    description: 'Is automation paused',
    default: false,
  })
  @IsBoolean()
  isPaused: boolean = false;

  // Communication optional fields
  @ApiProperty({ enum: CommunicationType, required: false })
  @IsOptional()
  @IsEnum(CommunicationType)
  communicationType?: CommunicationType;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isSendWeekDays?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isSendOfficeHours?: boolean;

  @ApiProperty({ example: 'Subject here', required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Email body', required: false })
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiProperty({ example: 'SMS body', required: false })
  @IsOptional()
  @IsString()
  smsBody?: string;

  @ApiProperty({
    description: 'Attachments for the automation',
    type: [AutomationAttachmentDto],
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutomationAttachmentDto)
  attachments?: AutomationAttachmentDto[];
}
