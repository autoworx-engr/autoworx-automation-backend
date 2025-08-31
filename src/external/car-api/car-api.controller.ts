import { Controller, Get, Query, Logger, UseGuards } from '@nestjs/common';
import { CarApiService } from './car-api.service';
import { MakesQueryParams } from './interfaces/makes.interface';
import { ModelsQueryParams } from './interfaces/models.interface';
import { YearsQueryParams } from './interfaces/years.interface';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

// @ApiBearerAuth('JWT-auth')
// @UseGuards(JwtAuthGuard)
@Controller('api/cars')
export class CarApiController {
  private readonly logger = new Logger(CarApiController.name);

  constructor(private readonly carApiService: CarApiService) {}

  @Get('makes')
  async getMakes(@Query() queryParams: MakesQueryParams) {
    return this.carApiService.getMakes(queryParams);
  }

  @Get('models')
  async getModels(@Query() queryParams: ModelsQueryParams) {
    return this.carApiService.getModels(queryParams);
  }

  @Get('years')
  async getYears(@Query() queryParams: YearsQueryParams) {
    return this.carApiService.getYears(queryParams);
  }
}
