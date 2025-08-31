import { PartialType } from '@nestjs/swagger';
import { CreateServiceAutomationRuleDto } from './create-service-automation-rule.dto';

export class UpdateServiceAutomationRuleDto extends PartialType(
  CreateServiceAutomationRuleDto,
) {}
