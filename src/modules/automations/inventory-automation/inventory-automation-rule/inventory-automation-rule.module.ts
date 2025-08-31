import { Module } from '@nestjs/common';
import { InventoryAutomationRuleController } from './inventory-automation-rule.controller';
import { InventoryAutomationRuleService } from './inventory-automation-rule.service';
import { InventoryAutomationRepository } from './repositories/inventory-automation-rule.repositories';

@Module({
  controllers: [InventoryAutomationRuleController],
  providers: [InventoryAutomationRuleService, InventoryAutomationRepository],
})
export class InventoryAutomationRuleModule {}
