import { Module } from '@nestjs/common';
import { ServiceAutomationRuleService } from './service-automation-rule.service';
import { ServiceAutomationRuleController } from './service-automation-rule.controller';
import { ServiceAutomationRuleRepository } from './repositories/service-automation-rule.repository';
import { ServiceAutomationTriggerModule } from '../service-automation-trigger/service-automation-trigger.module';

@Module({
  imports: [ServiceAutomationTriggerModule],
  controllers: [ServiceAutomationRuleController],
  providers: [ServiceAutomationRuleService, ServiceAutomationRuleRepository],
})
export class ServiceAutomationRuleModule {}
