import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CarApiController } from './car-api.controller';
import { CarApiService } from './car-api.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://carapi.app',
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [CarApiController],
  providers: [CarApiService],
  exports: [CarApiService],
})
export class CarApiModule {}
