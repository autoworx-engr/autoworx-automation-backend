import { PartialType } from '@nestjs/mapped-types';
import { CreateCommunicationAutomationDto } from './create-communication-automation.dto';

export class UpdateCommunicationAutomationDto extends PartialType(
  CreateCommunicationAutomationDto,
) {}
