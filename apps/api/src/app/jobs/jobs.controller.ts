import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CronSecretGuard } from './cron-secret.guard';
import { JobsService, StandupReminderRunResult } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('standup-reminders')
  @UseGuards(CronSecretGuard)
  @ApiOperation({
    summary:
      'Email team members who have not submitted standup for the team-local today',
  })
  @ApiHeader({
    name: 'X-Cron-Secret',
    description:
      'Must match CRON_SECRET (or use Authorization: Bearer <secret>)',
    required: true,
  })
  @ApiOkResponse({ description: 'Reminder run counters' })
  @ApiUnauthorizedResponse()
  runStandupReminders(): Promise<StandupReminderRunResult> {
    return this.jobs.runStandupReminders();
  }
}
