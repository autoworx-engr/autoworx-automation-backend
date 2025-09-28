import { createKeyv } from '@keyv/redis';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import configuration from 'src/config/configuration';
import { CarApiModule } from './external/car-api/car-api.module';
import { CommunicationAutomationModule } from './modules/automations/communication-automation/communication-automation-rule/communication-automation.module';
import { CommunicationAutomationTriggerModule } from './modules/automations/communication-automation/communication-automation-trigger/communication-automation-trigger.module';
import { MarketingAutomationModule } from './modules/automations/marketing-automation/marketing-automation.module';
import { PipelineAutomationModule } from './modules/automations/pipeline-automation/pipeline-automation.module';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalModule } from './shared/global-service/global.module';
import { ServiceAutomationModule } from './modules/automations/service-automation/service-automation.module';
import { InvoiceAutomationRuleModule } from './modules/automations/invoice-automation/invoice-automation-rule/invoice-automation-rule.module';
import { InvoiceAutomationTriggerModule } from './modules/automations/invoice-automation/invoice-automation-trigger/invoice-automation-trigger.module';
import { InventoryAutomationModule } from './modules/automations/inventory-automation/inventory-automation.module';
import { AdminPermissionModule } from './modules/admin-module-permission/admin-permission.module';
import { AuthModule } from './modules/auth/auth.module';

import { ReminderModule } from './modules/appointment-reminder-module/reminder.module';
import { NotificationModule } from './modules/notification/notification.module';
@Global()
@Module({
  imports: [
    GlobalModule,
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        console.log(
          "🚀 ~ configService.get('redis.url'):",
          configService.get('redis.url'),
        );
        console.log(
          "🚀 ~ configService.get('redis.host'):",
          configService.get('redis.host'),
        );
        console.log(
          "🚀 ~ configService.get('redis.port'):",
          configService.get('redis.port'),
        );
        console.log(
          "🚀 ~ configService.get('redis.username'):",
          configService.get('redis.username'),
        );
        console.log(
          "🚀 ~ configService.get('redis.password'):",
          configService.get('redis.password'),
        );

        const redisUrlFromConfig =
          configService.get<string>('redis.url') ?? process.env.REDIS_URL;

        // Prefer URL form; ioredis handles redis:// and rediss:// automatically.
        if (redisUrlFromConfig) {
          return {
            redis: redisUrlFromConfig, // e.g., redis://:password@host:port or rediss://...
          };
        }

        // Fallback to discrete fields when URL is not provided
        const host =
          configService.get<string>('redis.host') ?? process.env.REDIS_HOST;
        const port = parseInt(
          configService.get<string>('redis.port') ??
            process.env.REDIS_PORT ??
            '6379',
          10,
        );
        const password =
          configService.get<string>('redis.password') ??
          process.env.REDIS_PASSWORD;
        const username =
          configService.get<string>('redis.username') ??
          process.env.REDIS_USERNAME;

        const useTls = (process.env.REDIS_TLS || '').toLowerCase() === 'true'; // only enable if explicitly true

        return {
          redis: {
            host,
            port,
            password,
            ...(username ? { username } : {}),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            connectTimeout: 10000,
            maxConnections: 100,
            ...(useTls ? { tls: {} } : {}),
          },
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new Keyv({
            store: new CacheableMemory({ ttl: 3600000, lruSize: 5000 }),
          }),
          createKeyv(
            configService.get('node_env') === 'development'
              ? `redis://${configService.get('redis.host')}:${configService.get('redis.port')}`
              : configService.get<string>('redis.url') || process.env.REDIS_URL,
            {
              namespace: configService.get('redis.prefix') || 'autoworx:',
            },
          ),
        ],
      }),
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PipelineAutomationModule,
    CommunicationAutomationModule,
    CommunicationAutomationTriggerModule,
    MarketingAutomationModule,
    CarApiModule,
    ServiceAutomationModule,
    InvoiceAutomationRuleModule,
    InvoiceAutomationTriggerModule,
    InventoryAutomationModule,
    AdminPermissionModule,
    ReminderModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class AppModule {}
