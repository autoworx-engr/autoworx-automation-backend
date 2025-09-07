import { Module } from '@nestjs/common';
import { ServiceAutomationTriggerModule } from './service-automation-trigger/service-automation-trigger.module';
import { ServiceAutomationRuleModule } from './service-automation-rule/service-automation-rule.module';

@Module({
  controllers: [],
  providers: [],
  imports: [ServiceAutomationRuleModule, ServiceAutomationTriggerModule],
})
export class ServiceAutomationModule {}
