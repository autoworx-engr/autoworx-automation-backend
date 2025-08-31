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
import { CreatePipelineRuleDto } from '../dto/create-pipeline-rule.dto';
import { ResponsePipelineRuleDto } from '../dto/response-pipeline-rule.dto';
import { UpdatePipelineRuleDto } from '../dto/update-pipeline-rule.dto';
import { PipelineAutomationRuleService } from '../services/pipeline-automation-rule.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('pipeline-automation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pipeline-automation-rules')
export class PipelineAutomationRuleController {
  constructor(
    private readonly PipelineAutomationRuleService: PipelineAutomationRuleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline automation rule' })
  @ApiResponse({
    status: 201,
    description: 'The rule has been successfully created',
    type: ResponsePipelineRuleDto,
  })
  create(@Body() createPipelineRuleDto: CreatePipelineRuleDto) {
    return this.PipelineAutomationRuleService.create(createPipelineRuleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all pipeline automation rules for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of pipeline automation rules',
    type: [ResponsePipelineRuleDto],
  })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.PipelineAutomationRuleService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a pipeline automation rule by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Pipeline rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The found pipeline rule',
    type: ResponsePipelineRuleDto,
  })
  @ApiResponse({ status: 404, description: 'Pipeline rule not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.PipelineAutomationRuleService.findOne(id);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update a pipeline automation rule' })
  @ApiParam({ name: 'id', required: true, description: 'Pipeline rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The updated pipeline rule',
    type: ResponsePipelineRuleDto,
  })
  @ApiResponse({ status: 404, description: 'Pipeline rule not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePipelineRuleDto: UpdatePipelineRuleDto,
  ) {
    return this.PipelineAutomationRuleService.update(id, updatePipelineRuleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pipeline automation rule' })
  @ApiParam({ name: 'id', required: true, description: 'Pipeline rule ID' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Pipeline rule not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.PipelineAutomationRuleService.remove(id);
  }
}
