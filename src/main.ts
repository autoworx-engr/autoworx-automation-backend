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

  const reminderQueue = app.get<Queue>(getQueueToken('reminder-queue'));

  createBullBoard({
    queues: [new BullAdapter(reminderQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

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
            const allowedOrigins = (
              process.env.ACCESS_CORS_ORIGINS || ''
            ).split(',');
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
