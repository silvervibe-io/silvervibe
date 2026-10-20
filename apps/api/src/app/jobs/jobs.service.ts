import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StandupEntryStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calendarDateInTimezone,
  parseCalendarDate,
} from '../standups/standup-date.util';

export type StandupReminderRunResult = {
  teamsChecked: number;
  emailed: number;
  skippedNoEmail: number;
  skippedSubmitted: number;
  mailErrors: number;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async runStandupReminders(): Promise<StandupReminderRunResult> {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for reminder jobs',
      );
    }

    const enabled = await this.prisma.workspaceTool.findMany({
      where: { toolKey: 'vibestandup', enabled: true },
      select: { workspaceId: true },
    });
    const workspaceIds = enabled.map((row) => row.workspaceId);
    if (workspaceIds.length === 0) {
      return {
        teamsChecked: 0,
        emailed: 0,
        skippedNoEmail: 0,
        skippedSubmitted: 0,
        mailErrors: 0,
      };
    }

    const teams = await this.prisma.team.findMany({
      where: { workspaceId: { in: workspaceIds } },
      include: {
        standupConfig: true,
        members: { include: { user: true } },
      },
    });

    const standupBase = (
      process.env['PUBLIC_STANDUP_URL'] ?? 'http://localhost:4201'
    ).replace(/\/$/, '');

    let emailed = 0;
    let skippedNoEmail = 0;
    let skippedSubmitted = 0;
    let mailErrors = 0;

    for (const team of teams) {
      const tz = team.standupConfig?.timezone?.trim() || 'UTC';
      const day = calendarDateInTimezone(tz);
      const entryDate = parseCalendarDate(day);

      const submitted = await this.prisma.standupEntry.findMany({
        where: {
          teamId: team.id,
          entryDate,
          status: StandupEntryStatus.SUBMITTED,
        },
        select: { userId: true },
      });
      const submittedIds = new Set(submitted.map((row) => row.userId));

      for (const member of team.members) {
        if (submittedIds.has(member.userId)) {
          skippedSubmitted += 1;
          continue;
        }
        const to = member.user.email?.trim();
        if (!to) {
          skippedNoEmail += 1;
          continue;
        }

        const result = await this.mail.sendStandupReminder({
          to,
          teamName: team.name,
          entryDate: day,
          standupUrl: `${standupBase}/app`,
        });
        if (result.sent) {
          emailed += 1;
        } else {
          mailErrors += 1;
          this.logger.warn(
            `Reminder to ${to} for team ${team.id} failed: ${result.error ?? 'unknown'}`,
          );
        }
      }
    }

    return {
      teamsChecked: teams.length,
      emailed,
      skippedNoEmail,
      skippedSubmitted,
      mailErrors,
    };
  }
}
