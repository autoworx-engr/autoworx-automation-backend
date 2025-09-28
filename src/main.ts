import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bull';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue } from 'bull';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bull Board setup
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  try {
    const queueNames = [
      'reminder-queue',
      'communication-time-delay',
      'inventory-notifications',
      'invoice-time-delay',
      'marketing-campaign-trigger',
      'pipeline-time-delay',
      'service-time-delay',
    ];

    console.log('Attempting to register queues with Bull Board...');
    const queues: BullAdapter[] = [];

    for (const queueName of queueNames) {
      try {
        console.log(`Looking for queue: ${queueName}`);
        const queue = app.get<Queue>(getQueueToken(queueName));
        if (queue) {
          queues.push(new BullAdapter(queue));
          console.log(`✅ Added ${queueName} to Bull Board`);
        } else {
          console.log(`⚠️ Queue ${queueName} exists but is undefined`);
        }
      } catch (error) {
        console.error(
          `❌ Error registering queue ${queueName}:`,
          error.message,
        );
      }
    }

    if (queues.length > 0) {
      createBullBoard({
        queues,
        serverAdapter,
      });
      app.use('/admin/queues', serverAdapter.getRouter());
      console.log(`🎯 Bull Board configured with ${queues.length} queues`);
    }
    app.use('/debug/routes', (req, res) => {
      res.json({
        bullBoardMounted: !!queues.length,
        queuesCount: queues.length,
        bullBoardPath: '/admin/queues',
      });
    });
  } catch (error) {
    console.error('Error setting up Bull Board:', error);
  }

  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe());

  // Global response interceptor
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // cors policy
  app.enableCors({
    origin:
      // Allow all origins in development
      (origin: string, callback) => {
        const allowedOrigins = (process.env.ACCESS_CORS_ORIGINS || '').split(
          ',',
        );
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    credentials: process.env.ACCESS_CORS_ALLOW_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Setup Swagger documentation
  setupSwagger(app);

  const FALLBACK_PORT = 8000;
  await app.listen(process.env.PORT ?? FALLBACK_PORT);
}
bootstrap()
  .then(() => {
    console.log(`Application is running on: ${process.env.PORT ?? 8000}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  })
  .catch((error) => {
    console.error('Error starting the application:', error);
    process.exit(1);
  });
