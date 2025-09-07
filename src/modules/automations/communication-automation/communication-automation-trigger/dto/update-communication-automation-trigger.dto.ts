import { IsNumber } from 'class-validator';

export class UpdateCommunicationAutomationTriggerDto {
  companyId: number;
  @IsNumber({}, { message: 'leadId must be a number' })
  leadId: number;
  @IsNumber({}, { message: 'pipelineId must be a number' })
  columnId: number;
}
