// import { ApiProperty } from '@nestjs/swagger';
// import {
//   CommunicationType,
//   PipelineType,
//   TagConditionType,
//   TagRuleType,
// } from '@prisma/client';
// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsBoolean,
//   IsEnum,
//   IsInt,
//   IsOptional,
//   IsString,
//   ValidateNested,
// } from 'class-validator';
// import { AutomationAttachmentDto } from 'src/modules/automations/communication-automation/communication-automation-rule/dto/automation-attachment.dto';

// export class CreateTagAutomationRuleDto {
//   @ApiProperty({ example: 'Tag Follow Up' })
//   @IsString()
//   title: string;

//   @ApiProperty({ example: 1 })
//   @IsInt()
//   companyId: number;

//   @ApiProperty({ example: 0 })
//   @IsInt()
//   @IsOptional()
//   timeDelay?: number;

//   @ApiProperty({ enum: TagConditionType })
//   @IsEnum(TagConditionType)
//   condition_type: TagConditionType;

//   @ApiProperty({ enum: PipelineType })
//   @IsEnum(PipelineType)
//   pipelineType: PipelineType;

//   @ApiProperty({ enum: TagRuleType, required: false })
//   @IsEnum(TagRuleType)
//   @IsOptional()
//   ruleType?: TagRuleType;

//   @ApiProperty({ type: [Number], example: [1, 2] })
//   @IsArray()
//   @IsInt({ each: true })
//   tagIds: number[];

//   @ApiProperty({ type: [Number], example: [1, 2] })
//   @IsArray()
//   @IsInt({ each: true })
//   columnIds: number[];

//   @ApiProperty({
//     description: 'Is automation paused',
//     default: false,
//   })
//   @IsBoolean()
//   isPaused: boolean = false;

//   // Communication optional fields
//   @ApiProperty({ enum: CommunicationType, required: false })
//   @IsOptional()
//   @IsEnum(CommunicationType)
//   communicationType?: CommunicationType;

//   @ApiProperty({ example: true, required: false })
//   @IsOptional()
//   @IsBoolean()
//   isSendWeekDays?: boolean;

//   @ApiProperty({ example: true, required: false })
//   @IsOptional()
//   @IsBoolean()
//   isSendOfficeHours?: boolean;

//   @ApiProperty({ example: 'Subject here', required: false })
//   @IsOptional()
//   @IsString()
//   subject?: string;

//   @ApiProperty({ example: 'Email body', required: false })
//   @IsOptional()
//   @IsString()
//   emailBody?: string;

//   @ApiProperty({ example: 'SMS body', required: false })
//   @IsOptional()
//   @IsString()
//   smsBody?: string;

//   @ApiProperty({
//     description: 'Attachments for the automation',
//     type: [AutomationAttachmentDto],
//     required: false,
//   })
//   @IsOptional()
//   @ValidateNested({ each: true })
//   @Type(() => AutomationAttachmentDto)
//   attachments?: AutomationAttachmentDto[];
// }

import { ApiProperty } from '@nestjs/swagger';
import {
  CommunicationType,
  PipelineType,
  TagConditionType,
  TagRuleType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AutomationAttachmentDto } from 'src/modules/automations/communication-automation/communication-automation-rule/dto/automation-attachment.dto';

export class CreateTagAutomationRuleDto {
  @ApiProperty({ example: 'Post Tag Automation' })
  @IsString()
  title: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  companyId: number;

  @ApiProperty({ example: 3600 })
  @IsInt()
  @IsOptional()
  timeDelay?: number;

  @ApiProperty({ enum: TagConditionType, example: 'post_tag' })
  @IsEnum(TagConditionType)
  condition_type: TagConditionType;

  @ApiProperty({ enum: PipelineType, example: 'SALES' })
  @IsEnum(PipelineType)
  pipelineType: PipelineType;

  @ApiProperty({ enum: TagRuleType, example: 'one_time' })
  @IsEnum(TagRuleType)
  ruleType: TagRuleType;

  //  Required if pipelineType = sales or shop
  @ApiProperty({ type: [Number], example: [1, 2] })
  @ValidateIf(
    (o) =>
      o.pipelineType === PipelineType.SALES ||
      o.pipelineType === PipelineType.SHOP,
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  tagIds: number[];

  //  Required only for post_tag condition
  @ApiProperty({ type: [Number], example: [1, 2], required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.post_tag)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  columnIds?: number[];

  @ApiProperty({
    description: 'Is automation paused',
    default: false,
    example: 'false',
  })
  @IsBoolean()
  isPaused: boolean = false;

  //  Required only for pipeline condition
  @ApiProperty({ example: 1 })
  @ValidateIf((o) => o.condition_type === TagConditionType.pipeline)
  @IsInt()
  targetColumnId: number;

  //  Required only for communication condition
  @ApiProperty({ enum: CommunicationType, required: false, example: 'EMAIL' })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsEnum(CommunicationType)
  communicationType?: CommunicationType;

  @ApiProperty({ example: true, required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsBoolean()
  isSendWeekDays?: boolean;

  @ApiProperty({ example: false, required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsBoolean()
  isSendOfficeHours?: boolean;

  @ApiProperty({ example: 'Subject here', required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Email body', required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiProperty({ example: 'SMS body', required: false })
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @IsOptional()
  @IsString()
  smsBody?: string;

  @ApiProperty({
    description: 'Attachments for the automation',
    type: [AutomationAttachmentDto],
    required: false,
    examples: [
      { fileUrl: 'https://example.com/file1.pdf' },
      { fileUrl: 'https://example.com/file2.pdf' },
    ],
  })
  @IsOptional()
  @ValidateIf((o) => o.condition_type === TagConditionType.communication)
  @ValidateNested({ each: true })
  @Type(() => AutomationAttachmentDto)
  attachments?: AutomationAttachmentDto[];
}
