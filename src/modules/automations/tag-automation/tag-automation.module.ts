import { Module } from '@nestjs/common';
import { TagAutomationRuleModule } from './tag-automation-rule/tag-automation-rule.module';
import { TagAutomationTriggerModule } from './tag-automation-trigger/tag-automation-trigger.module';

@Module({
  providers: [],
  imports: [TagAutomationRuleModule, TagAutomationTriggerModule],
})
export class TagAutomationModule {}
