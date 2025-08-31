import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommunicationAutomationService } from './communication-automation.service';
import { CreateCommunicationAutomationDto } from './dto/create-communication-automation.dto';
import { UpdateCommunicationAutomationDto } from './dto/update-communication-automation.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('Communication Automation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('communication-automation')
export class CommunicationAutomationController {
  constructor(
    private readonly communicationAutomationService: CommunicationAutomationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new communication automation rule' })
  @ApiResponse({
    status: 201,
    description: 'The rule has been successfully created.',
  })
  create(@Body() createDto: CreateCommunicationAutomationDto) {
    return this.communicationAutomationService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all communication automation rules for a company',
  })
  @ApiResponse({ status: 200, description: 'Return all automation rules.' })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.communicationAutomationService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific communication automation rule' })
  @ApiResponse({ status: 200, description: 'Return the automation rule.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.communicationAutomationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a communication automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully updated.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCommunicationAutomationDto,
  ) {
    return this.communicationAutomationService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a communication automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.communicationAutomationService.remove(+id);
  }
}
