import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StandupEntryStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calendarDateInTimezone,
  clockInTimezone,
  clockLabel,
  instantAtLocalTime,
  isInReminderWindow,
  parseCalendarDate,
} from '../standups/standup-date.util';
import {
  scheduleFromConfig,
  type StandupSchedule,
} from '../standups/standup-schedule';
import { StandupsService } from '../standups/standups.service';
import { weekdayInTimezone, weekFromStorage } from '../users/work-hours';

export type StandupReminderRunResult = {
  teamsChecked: number;
  emailed: number;
  skippedNoEmail: number;
  skippedSubmitted: number;
  skippedAway: number;
  skippedOutsideWindow: number;
  mailErrors: number;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Optional()
    @Inject(StandupsService)
    private readonly standups: StandupsService | null = null,
  ) {}

  async runStandupReminders(
    now: Date = new Date(),
  ): Promise<StandupReminderRunResult> {
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
        skippedAway: 0,
        skippedOutsideWindow: 0,
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
    let skippedAway = 0;
    let skippedOutsideWindow = 0;
    let mailErrors = 0;

    for (const team of teams) {
      const schedule = scheduleFromConfig(team.standupConfig);
      const tz = schedule.timezone;

      if (schedule.reveal === 'together' && this.standups) {
        try {
          await this.standups.publishTogether(team.id, now);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Together summary failed for team ${team.id}: ${message}`,
          );
        }
      }

      const due = team.members.filter((member) =>
        isWorkdayStart(member.user, now),
      );
      if (due.length === 0) {
        skippedOutsideWindow += team.members.length;
        continue;
      }

      const day = calendarDateInTimezone(tz, now);
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
      const away = await this.prisma.standupAway.findMany({
        where: { teamId: team.id, entryDate },
        select: { userId: true },
      });
      const awayIds = new Set(away.map((row) => row.userId));
      skippedOutsideWindow += team.members.length - due.length;

      for (const member of due) {
        if (submittedIds.has(member.userId)) {
          skippedSubmitted += 1;
          continue;
        }
        if (awayIds.has(member.userId)) {
          skippedAway += 1;
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
          windowLabel: postingWindowLabel(
            schedule,
            member.user.timezone?.trim() || 'UTC',
            now,
          ),
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
      skippedAway,
      skippedOutsideWindow,
      mailErrors,
    };
  }
}

function isWorkdayStart(
  user: { timezone?: string | null; workHoursJson?: unknown },
  now: Date,
): boolean {
  const timeZone = user.timezone?.trim() || 'UTC';
  const hours = weekFromStorage(user.workHoursJson)[
    weekdayInTimezone(timeZone, now)
  ];
  if (!hours.enabled) {
    return false;
  }
  const [hour, minute] = hours.start.split(':').map((part) => Number(part));
  return isInReminderWindow(timeZone, hour, minute, now);
}

function postingWindowLabel(
  schedule: StandupSchedule,
  memberTimezone: string,
  now: Date,
): string {
  const day = calendarDateInTimezone(schedule.timezone, now);
  const end = clockInTimezone(
    memberTimezone,
    instantAtLocalTime(
      day,
      schedule.endHour,
      schedule.endMinute,
      schedule.timezone,
    ),
  );
  const endLabel = clockLabel(end.hour, end.minute);
  if (schedule.scheduleKind === 'deadline') {
    return `Post before ${endLabel} (${memberTimezone}).`;
  }
  const start = clockInTimezone(
    memberTimezone,
    instantAtLocalTime(
      day,
      schedule.windowStartHour,
      schedule.windowStartMinute,
      schedule.timezone,
    ),
  );
  return `Post between ${clockLabel(start.hour, start.minute)} and ${endLabel} (${memberTimezone}).`;
}
