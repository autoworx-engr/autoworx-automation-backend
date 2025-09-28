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
    // --- Bull (v3) ---
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('node_env') ?? 'development';
        console.log('🚀 ~ AppModule ~ nodeEnv:', nodeEnv);

        const redisUrl = config.get<string>('redis.url'); // e.g. redis://default:pass@redis.railway.internal:6379
        console.log('🚀 ~ AppModule ~ redisUrl:', redisUrl);
        const host = config.get<string>('redis.host') ?? 'localhost';
        console.log('🚀 ~ AppModule ~ host:', host);
        const port = Number(config.get<string>('redis.port') ?? 6379);
        console.log('🚀 ~ AppModule ~ port:', port);
        const username = config.get<string>('redis.username') || undefined;
        console.log('🚀 ~ AppModule ~ username:', username);
        const password = config.get<string>('redis.password') || undefined;
        console.log('🚀 ~ AppModule ~ password:', password);

        const familyEnv = config.get<string>('redis.family'); // '4' | '6' (optional)
        console.log('🚀 ~ AppModule ~ familyEnv:', familyEnv);

        // Prefer URL if provided.
        if (redisUrl) {
          const u = new URL(redisUrl);
          console.log('🚀 ~ AppModule ~ u:', u);
          const isRailwayInternal = u.hostname.endsWith('.railway.internal');
          console.log('🚀 ~ AppModule ~ isRailwayInternal:', isRailwayInternal);

          return {
            // When passing an object, DO NOT also pass `url`
            redis: {
              host: u.hostname,
              port: Number(u.port || 6379),
              username: u.username || undefined, // Railway often uses "default"
              password: u.password || undefined,
              family: familyEnv ? Number(familyEnv) : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              connectTimeout: 10_000,
              // No TLS on Railway private network
              tls: isRailwayInternal ? undefined : {}, // only add TLS if NOT internal
            },
          };
        }

        // Fallback to discrete fields
        const isRailwayInternal = host.endsWith('.railway.internal');
        return {
          redis: {
            host,
            port,
            username,
            password,
            family: familyEnv ? Number(familyEnv) : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            connectTimeout: 10_000,
            tls:
              nodeEnv !== 'development' && !isRailwayInternal ? {} : undefined,
          },
        };
      },
    }),

    // --- Cache (Keyv) ---
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('node_env') ?? 'development';
        console.log('🚀 ~ AppModule ~ nodeEnv:', nodeEnv);
        const host = config.get<string>('redis.host') ?? 'localhost';
        console.log('🚀 ~ AppModule ~ host:', host);
        const port = Number(config.get<string>('redis.port') ?? 6379);
        console.log('🚀 ~ AppModule ~ port:', port);
        const urlFromEnv = config.get<string>('redis.url'); // prefer this if present
        console.log('🚀 ~ AppModule ~ urlFromEnv:', urlFromEnv);
        const prefix = config.get<string>('redis.prefix') || 'autoworx:';
        console.log('🚀 ~ AppModule ~ prefix:', prefix);

        // Build a Redis URL for Keyv
        // If you already have REDIS_URL, use it as-is. Otherwise compose from host/port.
        const keyvRedisUrl = urlFromEnv ?? `redis://${host}:${port}`;
        console.log('🚀 ~ AppModule ~ keyvRedisUrl:', keyvRedisUrl);

        return {
          stores: [
            // In-memory LRU + TTL
            new Keyv({
              store: new CacheableMemory({ ttl: 3_600_000, lruSize: 5000 }),
              namespace: `${prefix}mem`,
            }),
            // Redis-backed cache
            createKeyv(keyvRedisUrl, { namespace: prefix }),
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
