import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServiceAutomationTriggerService } from '../services/service-automation-trigger.service';
import { UpdateServiceAutomationTriggerDto } from '../dto/update-service-automation-trigger.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('service-automation-trigger')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('service-automation-trigger')
export class ServiceAutomationTriggerController {
  constructor(
    private readonly ServiceAutomationTriggerService: ServiceAutomationTriggerService,
  ) {}

  @ApiOperation({
    summary:
      'Trigger an automation to update lead columns or send email/SMS to a client.',
    description:
      'This endpoint triggers an automation rule that can change a lead column or send an email/SMS to a client on behalf of the company.',
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
  update(@Body() body: UpdateServiceAutomationTriggerDto) {
    return this.ServiceAutomationTriggerService.update(body);
  }
}
