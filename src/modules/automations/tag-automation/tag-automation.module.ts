import { Module } from '@nestjs/common';
import { TagAutomationRuleModule } from './tag-automation-rule/tag-automation-rule.module';

@Module({
  providers: [],
  imports: [TagAutomationRuleModule],
})
export class TagAutomationModule {}
