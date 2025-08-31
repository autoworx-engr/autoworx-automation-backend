import { Module } from '@nestjs/common';
import { MarketingAutomationRuleController } from './controllers/marketing-automation-rule.controller';
import { MarketingAutomationRuleService } from './services/marketing-automation-rule.service';
import { MarketingAutomationRuleRepository } from './repositories/marketing-automation-rule.repository';
import { MarketingAutomationTriggerModule } from '../marketing-automation-rule-trigger/marketing-automation-rule-trigger.module';

@Module({
  imports: [MarketingAutomationTriggerModule],
  controllers: [MarketingAutomationRuleController],
  providers: [
    MarketingAutomationRuleService,
    MarketingAutomationRuleRepository,
  ],
})
export class MarketingAutomationRuleModule {}
