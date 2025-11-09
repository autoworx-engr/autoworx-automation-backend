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
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tag-automation-trigger')
export class TagAutomationTriggerController {
  constructor(
    private readonly tagAutomationTriggerService: TagAutomationTriggerService,
  ) {}

  @ApiOperation({
    summary: 'Trigger an tag automation!.',
    description:
      'This endpoint triggers an tag automation rule that can update lead column, send an email/SMS or add tag to a lead on behalf of the company.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        statusCode: 200,
        message: 'Tag Automation triggered successfully',
      },
    },
  })
  @Patch()
  update(@Body() body: UpdateTagAutomationTriggerDto) {
    return this.tagAutomationTriggerService.update(body);
  }
}
