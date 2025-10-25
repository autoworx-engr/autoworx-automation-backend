import { Body, Controller, Post } from '@nestjs/common';
import { AutoClockOutService } from './auto-clockout.service';
import { ScheduleAutoClockOutDto } from './dto/schedule-auto-clockout.dto';

@Controller('auto-clockout')
export class AutoClockOutController {
  constructor(private readonly autoClockOutService: AutoClockOutService) {}

  @Post('schedule')
  async scheduleAutoClockOut(@Body() body: ScheduleAutoClockOutDto) {
    await this.autoClockOutService.scheduleAutoClockOut(
      body.clockInOutId,
      body.userId,
      body.companyId,
      new Date(body.clockIn),
      body.timezone as string,
    );
    return { status: 'scheduled' };
  }
}
