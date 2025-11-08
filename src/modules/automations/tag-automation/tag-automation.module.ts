import { Module } from '@nestjs/common';
import { TagAutomationRuleModule } from './tag-automation-rule/tag-automation-rule.module';
import { InvoiceAutomationTriggerModule } from './tag-automation-trigger/tag-automation-trigger.module';

@Module({
  providers: [],
  imports: [TagAutomationRuleModule, InvoiceAutomationTriggerModule],
})
export class TagAutomationModule {}
