import { Module } from '@nestjs/common';
import { InventoryAutomationRuleModule } from './inventory-automation-rule/inventory-automation-rule.module';
import { InventoryTriggerModule } from './inventory-automation-trigger/inventory-trigger.module';

@Module({
  imports: [InventoryAutomationRuleModule, InventoryTriggerModule],
  exports: [InventoryAutomationRuleModule, InventoryTriggerModule],
})
export class InventoryAutomationModule {}
