import { Body, Controller, Patch, Logger, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConditionType } from '@prisma/client';
import { PipelineAutomationTriggerService } from '../services/pipeline-automation-trigger.service';
import { UpdatePipelineAutomationTriggerDto } from '../dto/update-pipeline-automation-trigger.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('Pipeline Automation Trigger')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pipeline-automation-trigger')
export class PipelineAutomationTriggerController {
  private readonly logger = new Logger(
    PipelineAutomationTriggerController.name,
  );
  constructor(
    private readonly pipelineAutomationTriggerService: PipelineAutomationTriggerService,
  ) {}

  @Patch()
  @ApiOperation({
    summary: 'Automation trigger to update pipeline leads',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline automation trigger updated successfully',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async update(
    @Body()
    updatePipelineAutomationTriggerDto: UpdatePipelineAutomationTriggerDto,
  ) {
    const result = await this.pipelineAutomationTriggerService.update(
      updatePipelineAutomationTriggerDto,
    );

    if (!result) {
      this.logger.log('Pipeline automation trigger failed!');

      return;
    }

    // Handle time delay response
    if ('jobId' in result) {
      return {
        statusCode: 200,
        message: 'Pipeline automation time delay scheduled successfully',
        data: {
          scheduled: true,
          jobId: result.jobId,
        },
      };
    }

    // Handle immediate execution response
    return {
      statusCode: 200,
      message: 'Pipeline automation trigger updated successfully',
      data: result,
    };
  }
}
