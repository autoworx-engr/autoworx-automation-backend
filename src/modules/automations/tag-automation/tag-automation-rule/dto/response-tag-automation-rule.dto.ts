import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---------- Basic Models ----------

export class TagResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() textColor: string;
  @ApiProperty() bgColor: string;
  @ApiProperty() type: string;
  @ApiProperty() companyId: number;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class ColumnResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty() type: string;
  @ApiProperty() order: number;
  @ApiProperty() textColor: string;
  @ApiProperty() bgColor: string;
  @ApiProperty() companyId: number;
}

export class AttachmentResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() fileUrl: string;
  @ApiPropertyOptional() tagCommunicationId?: number;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

// ---------- Communication Automation ----------

export class TagAutomationCommunicationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() tagAutomationId: number;
  @ApiProperty() communicationType: string;
  @ApiProperty() isSendWeekDays: boolean;
  @ApiProperty() isSendOfficeHours: boolean;
  @ApiProperty() subject: string;
  @ApiProperty() emailBody: string;
  @ApiProperty() smsBody: string;
  @ApiProperty({ type: [AttachmentResponseDto] })
  attachments: AttachmentResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

// ---------- Pipeline Automation ----------

export class TagAutomationPipelineResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() tagAutomationId: number;
  @ApiProperty() targetColumnId: number;
  @ApiProperty({ type: ColumnResponseDto })
  column: ColumnResponseDto;
}

// ---------- Post Tag Automation ----------

export class PostTagAutomationColumnResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() tagAutomationId: number;
  @ApiProperty({ type: [ColumnResponseDto] })
  columnIds: ColumnResponseDto[];
}

// ---------- Unified Automation Data ----------

export class TagAutomationDataResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() companyId: number;
  @ApiProperty() title: string;
  @ApiProperty() timeDelay: number;
  @ApiProperty() isPaused: boolean;
  @ApiProperty() condition_type: string;
  @ApiProperty() pipelineType: string;
  @ApiProperty() ruleType: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  @ApiPropertyOptional({ type: TagAutomationCommunicationResponseDto })
  tagAutomationCommunication?: TagAutomationCommunicationResponseDto;

  @ApiPropertyOptional({ type: TagAutomationPipelineResponseDto })
  tagAutomationPipeline?: TagAutomationPipelineResponseDto;

  @ApiPropertyOptional({ type: [PostTagAutomationColumnResponseDto] })
  PostTagAutomationColumn?: PostTagAutomationColumnResponseDto[];

  @ApiProperty({ type: [TagResponseDto] })
  tag: TagResponseDto[];
}

// ---------- Standardized Base Wrapper ----------

export class BaseTagAutomationResponseDto {
  @ApiProperty({ example: true }) status: boolean;
  @ApiProperty({ example: 200 }) statusCode: number;
  @ApiProperty({ example: 'Success' }) message: string;
  @ApiProperty({ type: TagAutomationDataResponseDto })
  data: TagAutomationDataResponseDto;
  @ApiProperty({ example: '2025-11-06T16:10:11.471Z' }) timestamp: string;
  @ApiProperty({ example: '/tag-automation-rules' }) path: string;
}
