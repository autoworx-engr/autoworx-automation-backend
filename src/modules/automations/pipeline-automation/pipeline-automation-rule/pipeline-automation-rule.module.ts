import { Module } from '@nestjs/common';
import { PipelineAutomationRuleController } from './controllers/pipeline-automation-rule.controller';
import { PipelineAutomationRuleService } from './services/pipeline-automation-rule.service';
import { PipelineAutomationRuleRepository } from './repositories/pipeline-automation-rule.repository';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  controllers: [PipelineAutomationRuleController],
  providers: [PipelineAutomationRuleService, PipelineAutomationRuleRepository],
})
export class PipelineAutomationRuleModule {}
