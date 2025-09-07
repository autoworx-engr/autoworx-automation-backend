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
import { InventoryAutomationRuleService } from './inventory-automation-rule.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateInventoryRuleDto } from './dto/create-inventory-rule.dto';
import { UpdateInventoryRuleDto } from './dto/update-inventory-rule.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('inventory-automation-rule')
export class InventoryAutomationRuleController {
  constructor(
    private readonly inventoryAutomationService: InventoryAutomationRuleService,
  ) {}
  @Post()
  @ApiOperation({ summary: 'Create a new inventory automation rule' })
  @ApiResponse({
    status: 201,
    description: 'The rule has been successfully created.',
  })
  create(@Body() createDto: CreateInventoryRuleDto) {
    return this.inventoryAutomationService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all inventory automation rules for a company',
  })
  @ApiResponse({ status: 200, description: 'Return all automation rules.' })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.inventoryAutomationService.getAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific inventory automation rule' })
  @ApiResponse({ status: 200, description: 'Return the automation rule.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryAutomationService.getOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a inventory automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully updated.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateInventoryRuleDto,
  ) {
    return this.inventoryAutomationService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a inventory automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryAutomationService.delete(+id);
  }
}
