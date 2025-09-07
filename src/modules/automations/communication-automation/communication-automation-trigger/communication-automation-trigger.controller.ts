import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { CommunicationAutomationTriggerService } from './communication-automation-trigger.service';
import { UpdateCommunicationAutomationTriggerDto } from './dto/update-communication-automation-trigger.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('communication-automation-trigger')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('communication-automation-trigger')
export class CommunicationAutomationTriggerController {
  constructor(
    private readonly communicationAutomationTriggerService: CommunicationAutomationTriggerService,
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
  update(@Body() body: UpdateCommunicationAutomationTriggerDto) {
    return this.communicationAutomationTriggerService.update(body);
  }
}
