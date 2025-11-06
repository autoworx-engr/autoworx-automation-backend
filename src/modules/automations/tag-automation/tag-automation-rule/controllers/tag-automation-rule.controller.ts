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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';
import { TagAutomationRuleService } from '../services/tag-automation-rule.service';

@ApiTags('tag-automation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tag-automation-rules')
export class TagAutomationRuleController {
  constructor(
    private readonly tagAutomationRuleService: TagAutomationRuleService,
  ) {}

  @Post()
  @ApiBody({
    description: 'Create Tag Automation Rule',
    type: CreateTagAutomationRuleDto,
    examples: {
      salesPipeline: {
        summary: 'Sales → Pipeline',
        value: {
          title: 'Pipeline Tag Automation',
          companyId: 1,
          pipelineType: 'SALES',
          condition_type: 'pipeline',
          ruleType: 'one_time',
          timeDelay: 3600,
          isPaused: false,
          tagIds: [1, 2],
          targetColumnId: 1,
        },
      },
      shopPostTag: {
        summary: 'Shop → Post Tag',
        value: {
          title: 'Post Tag Automation',
          companyId: 1,
          pipelineType: 'SHOP',
          condition_type: 'post_tag',
          ruleType: 'one_time',
          timeDelay: 86400,
          isPaused: false,
          tagIds: [1, 2],
          columnIds: [2, 3],
        },
      },
      salesCommunication: {
        summary: 'Sales → Communication',
        value: {
          title: 'Communication Tag Automation',
          companyId: 1,
          pipelineType: 'SALES',
          condition_type: 'communication',
          ruleType: 'recurring',
          timeDelay: 1800,
          isPaused: false,
          tagIds: [1, 2],
          communicationType: 'EMAIL',
          isSendWeekDays: true,
          isSendOfficeHours: false,
          subject: 'Follow Up Email',
          emailBody: 'Hello {{lead_name}}, please check this!',
          smsBody: 'Hi {{lead_name}}, reminder!',
          attachments: [
            { fileUrl: 'https://example.com/file1.pdf' },
            { fileUrl: 'https://example.com/file2.pdf' },
          ],
        },
      },
    },
  })
  @ApiOperation({ summary: 'Create a new tag automation rule' })
  @ApiResponse({
    status: 201,
    description: 'Rule created successfully',
  })
  create(@Body() createDto: CreateTagAutomationRuleDto) {
    return this.tagAutomationRuleService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tag automation rules for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of tag automation rules',
  })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.tagAutomationRuleService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tag automation rule by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Tag automation rule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'The found tag automation rule',
  })
  @ApiResponse({ status: 404, description: 'Tag automation rule not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tagAutomationRuleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag automation rule' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Tag automation rule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'The updated tag automation rule',
  })
  @ApiResponse({ status: 404, description: 'Tag automation rule not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTagAutomationRuleDto,
  ) {
    return this.tagAutomationRuleService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag automation rule' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Tag automation rule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Tag automation rule not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagAutomationRuleService.remove(id);
  }
}
