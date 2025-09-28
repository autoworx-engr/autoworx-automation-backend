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
        // Prefer explicit URL. If it points to railway.internal and we’re not on Railway, fall back to REDIS_PUBLIC_URL.
        let redisUrlFromConfig =
          configService.get<string>('redis.url') ??
          process.env.REDIS_URL ??
          process.env.REDIS_PUBLIC_URL;

        const isRailwayEnv =
          !!process.env.RAILWAY_PROJECT_ID || !!process.env.RAILWAY_ENVIRONMENT;

        if (
          redisUrlFromConfig &&
          redisUrlFromConfig.includes('redis.railway.internal') &&
          !isRailwayEnv &&
          process.env.REDIS_PUBLIC_URL
        ) {
          console.warn(
            'Detected internal Railway Redis URL while not running on Railway. Falling back to REDIS_PUBLIC_URL.',
          );
          redisUrlFromConfig = process.env.REDIS_PUBLIC_URL!;
        }

        if (redisUrlFromConfig) {
          console.log('Using Redis URL for Bull:', redisUrlFromConfig);
          return {
            redis: redisUrlFromConfig, // supports redis:// and rediss://
          };
        }

        // Fallback to discrete fields when URL is not provided
        const host =
          configService.get<string>('redis.host') ??
          process.env.REDIS_HOST ??
          process.env.REDISHOST;
        const port = parseInt(
          configService.get<string>('redis.port') ??
            process.env.REDIS_PORT ??
            process.env.REDISPORT ??
            '6379',
          10,
        );
        const password =
          configService.get<string>('redis.password') ??
          process.env.REDIS_PASSWORD ??
          process.env.REDISPASSWORD;
        const username =
          configService.get<string>('redis.username') ??
          process.env.REDIS_USERNAME ??
          process.env.REDISUSER;

        const useTls = (process.env.REDIS_TLS || '').toLowerCase() === 'true';

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
      useFactory: (configService: ConfigService) => {
        let cacheRedisUrl =
          (configService.get<string>('redis.url') as string) ||
          process.env.REDIS_URL ||
          process.env.REDIS_PUBLIC_URL ||
          `redis://${configService.get('redis.host') || process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1'}:${configService.get('redis.port') || process.env.REDIS_PORT || process.env.REDISPORT || '6379'}`;

        const isRailwayEnv =
          !!process.env.RAILWAY_PROJECT_ID || !!process.env.RAILWAY_ENVIRONMENT;

        if (
          cacheRedisUrl.includes('redis.railway.internal') &&
          !isRailwayEnv &&
          process.env.REDIS_PUBLIC_URL
        ) {
          console.warn(
            'Cache: internal Railway Redis URL detected locally. Using REDIS_PUBLIC_URL.',
          );
          cacheRedisUrl = process.env.REDIS_PUBLIC_URL!;
        }

        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 3600000, lruSize: 5000 }),
            }),
            createKeyv(cacheRedisUrl, {
              namespace:
                configService.get('redis.prefix') ||
                process.env.REDIS_PREFIX ||
                'autoworx:',
            }),
          ],
        };
      },
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
