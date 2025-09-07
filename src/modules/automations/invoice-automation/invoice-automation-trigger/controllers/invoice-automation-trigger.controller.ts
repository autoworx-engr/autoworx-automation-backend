import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateInvoiceAutomationTriggerDto } from '../dto/update-invoice-automation-trigger.dto';
import { InvoiceAutomationTriggerService } from '../services/invoice-automation-trigger.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('invoice-automation-trigger')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('invoice-automation-trigger')
export class InvoiceAutomationTriggerController {
  constructor(
    private readonly invoiceAutomationTriggerService: InvoiceAutomationTriggerService,
  ) {}

  @ApiOperation({
    summary: 'Trigger an automation to send email/SMS to a client.',
    description:
      'This endpoint triggers an automation rule that can send an email/SMS to a client on behalf of the company.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        statusCode: 200,
        message: 'Automation triggered successfully',
      },
    },
  })
  @Patch()
  update(@Body() body: UpdateInvoiceAutomationTriggerDto) {
    return this.invoiceAutomationTriggerService.update(body);
  }
}
