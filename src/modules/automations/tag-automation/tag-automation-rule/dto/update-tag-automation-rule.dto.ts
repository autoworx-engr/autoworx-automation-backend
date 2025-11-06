import { PartialType } from '@nestjs/mapped-types';
import { CreateTagAutomationRuleDto } from './create-tag-automation-rule.dto';

export class UpdateTagAutomationRuleDto extends PartialType(
  CreateTagAutomationRuleDto,
) {}
