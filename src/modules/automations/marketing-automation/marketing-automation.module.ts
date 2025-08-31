import { Module } from '@nestjs/common';
import { MarketingAutomationRuleModule } from './marketing-automation-rule/marketing-automation-rule.module';
import { MarketingAutomationTriggerModule } from './marketing-automation-rule-trigger/marketing-automation-rule-trigger.module';

@Module({
  controllers: [],
  providers: [],
  imports: [MarketingAutomationRuleModule, MarketingAutomationTriggerModule],
})
export class MarketingAutomationModule {}
