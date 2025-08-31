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
import { InvoiceAutomationRuleService } from '../invoice-automation-rule.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInvoiceRuleDto } from '../dto/create-invoice-rule.dto';
import { UpdateInvoiceRuleDto } from '../dto/update-invoice-rule.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('invoice-automation-rule')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('invoice-automation-rule')
export class InvoiceAutomationRuleController {
  constructor(
    private readonly invoiceAutomationService: InvoiceAutomationRuleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice automation rule' })
  @ApiResponse({
    status: 201,
    description: 'The rule has been successfully created.',
  })
  create(@Body() createDto: CreateInvoiceRuleDto) {
    return this.invoiceAutomationService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all invoice automation rules for a company',
  })
  @ApiResponse({ status: 200, description: 'Return all automation rules.' })
  findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    return this.invoiceAutomationService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific invoice automation rule' })
  @ApiResponse({ status: 200, description: 'Return the automation rule.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceAutomationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a invoice automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully updated.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateInvoiceRuleDto,
  ) {
    return this.invoiceAutomationService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a invoice automation rule' })
  @ApiResponse({
    status: 200,
    description: 'The rule has been successfully deleted.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceAutomationService.delete(+id);
  }
}
