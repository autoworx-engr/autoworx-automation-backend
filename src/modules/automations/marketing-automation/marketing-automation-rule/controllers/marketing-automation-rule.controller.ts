import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateMarketingRuleDto } from '../dto/create-marketing-rule.dto';
import { ResponseMarketingRuleDto } from '../dto/response-marketing-rule.dto';
import { UpdateMarketingRuleDto } from '../dto/update-marketing-rule.dto';
import { MarketingAutomationRuleService } from '../services/marketing-automation-rule.service';
import { MarketingAutomationTriggerService } from '../../marketing-automation-rule-trigger/services/marketing-automation-rule-trigger.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('marketing-automation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('marketing-automation-rules')
export class MarketingAutomationRuleController {
  constructor(
    private readonly marketingAutomationRuleService: MarketingAutomationRuleService,
    private readonly marketingAutomationTriggerService: MarketingAutomationTriggerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new marketing automation rule' })
  @ApiResponse({
    status: 201,
    description: 'The rule has been successfully created',
    type: ResponseMarketingRuleDto,
  })
  async create(@Body() createMarketingRuleDto: CreateMarketingRuleDto) {
    const result = await this.marketingAutomationRuleService.create(
      createMarketingRuleDto,
    );
    await this.marketingAutomationTriggerService.handleStartCampaign(
      result.companyId as number,
    );
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get all marketing automation rules for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of marketing automation rules',
    type: [ResponseMarketingRuleDto],
  })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.marketingAutomationRuleService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a marketing automation rule by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Marketing rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The found marketing rule',
    type: ResponseMarketingRuleDto,
  })
  @ApiResponse({ status: 404, description: 'Marketing rule not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.marketingAutomationRuleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a marketing automation rule' })
  @ApiParam({ name: 'id', required: true, description: 'Marketing rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The updated marketing rule',
    type: ResponseMarketingRuleDto,
  })
  @ApiResponse({ status: 404, description: 'Marketing rule not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMarketingRuleDto: UpdateMarketingRuleDto,
  ) {
    const result = await this.marketingAutomationRuleService.update(
      id,
      updateMarketingRuleDto,
    );

    await this.marketingAutomationTriggerService.handleStartCampaign(
      result.companyId as number,
    );
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a marketing automation rule' })
  @ApiParam({ name: 'id', required: true, description: 'Marketing rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Marketing rule not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marketingAutomationRuleService.remove(id);
  }
}
