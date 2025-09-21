import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🔧 Environment:', process.env.NODE_ENV);
  console.log('🔧 Redis URL configured:', !!process.env.REDIS_HOST);
  console.log('🔧 Redis URL configured:', process.env.REDIS_HOST);
  console.log('🔧 Redis URL configured:', process.env.REDIS_PORT);
  console.log('🔧 Redis URL configured:', process.env.REDIS_PASSWORD);
  console.log('🔧 Redis URL configured:', !!process.env.REDIS_TLS);
  console.log('🔧 Redis URL configured:', process.env.REDIS_TLS);
  console.log('🔧 Current working directory:', process.cwd());
  console.log('🔧 Worker file path:', __filename);

  // ...existing code...
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('🚀 BullMQ Worker started');

  // Keep the worker running
  process.on('SIGINT', () => {
    console.log('🛑 Worker shutting down...');
    app
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Error during shutdown:', err);
        process.exit(1);
      });
  });
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
