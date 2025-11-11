import { Module } from '@nestjs/common';
import { TagAutomationRuleController } from './controllers/tag-automation-rule.controller';
import { TagAutomationRuleRepository } from './repositories/tag-automation-rule.repository';
import { TagAutomationRuleService } from './services/tag-automation-rule.service';

@Module({
  controllers: [TagAutomationRuleController],
  providers: [TagAutomationRuleService, TagAutomationRuleRepository],
})
export class TagAutomationRuleModule {}
