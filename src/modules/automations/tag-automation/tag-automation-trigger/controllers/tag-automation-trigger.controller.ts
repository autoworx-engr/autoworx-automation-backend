import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { UpdateTagAutomationTriggerDto } from '../dto/update-tag-automation-trigger.dto';
import { TagAutomationTriggerService } from '../services/tag-automation-trigger.service';

@ApiTags('tag-automation-trigger')
// @ApiBearerAuth('JWT-auth')
// @UseGuards(JwtAuthGuard)
@Controller('tag-automation-trigger')
export class TagAutomationTriggerController {
  constructor(
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
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
  update(@Body() body: UpdateTagAutomationTriggerDto) {
    return this.tagAutomationTriggerService.update(body);
  }
}
