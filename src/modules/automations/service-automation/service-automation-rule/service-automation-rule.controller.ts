import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServiceAutomationRuleService } from './service-automation-rule.service';
import { CreateServiceAutomationRuleDto } from './dto/create-service-automation-rule.dto';
import { UpdateServiceAutomationRuleDto } from './dto/update-service-automation-rule.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('service-automation-rule')
export class ServiceAutomationRuleController {
  constructor(
    private readonly serviceAutomationRuleService: ServiceAutomationRuleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'create a service automation rule' })
  @ApiBody({
    type: CreateServiceAutomationRuleDto,
    description: 'The create service automation rule data',
  })
  @ApiResponse({
    status: 201,
    description: 'The created service automation rule',
  })
  async create(
    @Body() createServiceAutomationRuleDto: CreateServiceAutomationRuleDto,
  ) {
    const result = await this.serviceAutomationRuleService.create(
      createServiceAutomationRuleDto,
    );

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get all service automation rules for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of service automation rules',
  })
  findAll(@Query('companyId') companyId: string) {
    return this.serviceAutomationRuleService.findAll(+companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service automation rule by id' })
  @ApiResponse({
    status: 200,
    description: 'Service automation rule query by id',
  })
  @ApiParam({
    name: 'id',
    required: true,
  })
  findOne(@Param('id') id: string) {
    return this.serviceAutomationRuleService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service automation rule by id' })
  @ApiBody({
    type: UpdateServiceAutomationRuleDto,
    description: 'The updated service automation rule data',
  })
  @ApiResponse({
    status: 200,
    description: 'The updated service automation rule',
  })
  async update(
    @Param('id') id: string,
    @Body() updateServiceAutomationRuleDto: UpdateServiceAutomationRuleDto,
  ) {
    const result = await this.serviceAutomationRuleService.update(
      +id,
      updateServiceAutomationRuleDto,
    );

    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service automation rule by id' })
  @ApiResponse({
    status: 200,
    description: 'The deleted service automation rule',
  })
  remove(@Param('id') id: string) {
    return this.serviceAutomationRuleService.remove(+id);
  }
}
