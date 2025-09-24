import { Module } from '@nestjs/common';
import { PipelineAutomationRuleController } from './controllers/pipeline-automation-rule.controller';
import { PipelineAutomationRuleService } from './services/pipeline-automation-rule.service';
import { PipelineAutomationRuleRepository } from './repositories/pipeline-automation-rule.repository';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    // Since you have isGlobal: true in the main module, you can actually
    // remove this CacheModule registration if you prefer
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        ttl: 60 * 60, // 1 hour cache TTL in seconds
      }),
    }),
  ],
  controllers: [PipelineAutomationRuleController],
  providers: [PipelineAutomationRuleService, PipelineAutomationRuleRepository],
})
export class PipelineAutomationRuleModule {}
