import { PartialType } from '@nestjs/swagger';
import { CreateInventoryRuleDto } from './create-inventory-rule.dto';

export class UpdateInventoryRuleDto extends PartialType(
  CreateInventoryRuleDto,
) {}
