import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
  console.log('🚀 BullMQ Worker started');
}
bootstrap().catch((error) => {
  console.error('Error starting BullMQ Worker:', error);
});
