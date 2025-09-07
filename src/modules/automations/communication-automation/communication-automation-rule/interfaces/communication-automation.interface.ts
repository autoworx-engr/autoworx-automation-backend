import {
  CommunicationType,
  TemplateType,
} from '../enums/communication-type.enum';

export interface ICommunicationAutomation {
  id: number;
  companyId: number;
  title: string;
  stages: ICommunicationStage[];
  timeDelay: number;
  targetColumnId?: number;
  communicationType: CommunicationType;
  isSendWeekDays: boolean;
  templateType: TemplateType;
  subject?: string;
  body: string;
  isPaused: boolean;
  createdBy: string;
  attachments?: IAutomationAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunicationStage {
  id: number;
  communicationRuleId: number;
  columnId: number;
}

export interface IAutomationAttachment {
  id: number;
  fileUrl: string;
  communicationId?: number;
  createdAt: Date;
  updatedAt: Date;
}
