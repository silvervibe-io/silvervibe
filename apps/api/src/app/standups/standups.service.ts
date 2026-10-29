import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { StandupEntryStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { GithubService } from '../addons/github/github.service';
import { JiraService } from '../addons/jira/jira.service';
import { LinearService } from '../addons/linear/linear.service';
import { SlackService } from '../addons/slack/slack.service';
import { TeamsService as MsTeamsService } from '../addons/teams/teams.service';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import {
  StandupConfigDto,
  StandupEntryDto,
  StandupSummaryDto,
  UpsertStandupEntryDto,
} from './standup.dto';
import { calendarDateInTimezone, parseCalendarDate } from './standup-date.util';

@Injectable()
export class StandupsService {
  private readonly logger = new Logger(StandupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly teams: TeamsService,
    private readonly ai: AiService,
    private readonly slack: SlackService,
    private readonly msTeams: MsTeamsService,
    private readonly linear: LinearService,
    private readonly github: GithubService,
    private readonly jira: JiraService,
  ) {}

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for standups',
      );
    }
  }

  private async resolveEntryDate(
    teamId: string,
    dateStr?: string,
  ): Promise<Date> {
    if (dateStr?.trim()) {
      return parseCalendarDate(dateStr);
    }
    const config = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    const tz = config?.timezone?.trim() || 'UTC';
    return parseCalendarDate(calendarDateInTimezone(tz));
  }

  private toEntryDto(entry: {
    id: string;
    teamId: string;
    entryDate: Date;
    status: StandupEntryStatus;
    yesterday: string | null;
    today: string | null;
    blockers: string | null;
  }): StandupEntryDto {
    return {
      id: entry.id,
      teamId: entry.teamId,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      status: entry.status,
      yesterday: entry.yesterday,
      today: entry.today,
      blockers: entry.blockers,
    };
  }

  async getConfig(
    teamId: string,
    user: VerifiedUser,
  ): Promise<StandupConfigDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamMember(teamId, userId);

    let config = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    if (!config) {
      config = await this.prisma.standupConfig.create({
        data: { teamId },
      });
    }

    return {
      teamId,
      timezone: config.timezone,
      reminderHour: config.reminderHour,
      reminderMinute: config.reminderMinute,
      questionsJson: config.questionsJson as Record<string, string>,
    };
  }

  async updateConfig(
    teamId: string,
    user: VerifiedUser,
    timezone: string,
    reminderHour: number,
    reminderMinute: number,
    questionsJson: Record<string, string>,
  ): Promise<StandupConfigDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamAdmin(teamId, userId);

    const config = await this.prisma.standupConfig.upsert({
      where: { teamId },
      create: {
        teamId,
        timezone,
        reminderHour,
        reminderMinute,
        questionsJson,
      },
      update: { timezone, reminderHour, reminderMinute, questionsJson },
    });

    return {
      teamId,
      timezone: config.timezone,
      reminderHour: config.reminderHour,
      reminderMinute: config.reminderMinute,
      questionsJson: config.questionsJson as Record<string, string>,
    };
  }

  async getMine(
    teamId: string,
    user: VerifiedUser,
    dateStr?: string,
  ): Promise<StandupEntryDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamMember(teamId, userId);
    const entryDate = await this.resolveEntryDate(teamId, dateStr);

    let entry = await this.prisma.standupEntry.findUnique({
      where: {
        teamId_userId_entryDate: { teamId, userId, entryDate },
      },
    });
    if (!entry) {
      entry = await this.prisma.standupEntry.create({
        data: {
          teamId,
          userId,
          entryDate,
          status: StandupEntryStatus.DRAFT,
        },
      });
    }
    return this.toEntryDto(entry);
  }

  async upsertMine(
    teamId: string,
    user: VerifiedUser,
    body: UpsertStandupEntryDto,
    dateStr?: string,
  ): Promise<StandupEntryDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamMember(teamId, userId);
    const entryDate = await this.resolveEntryDate(teamId, dateStr);
    const status =
      body.status === 'SUBMITTED'
        ? StandupEntryStatus.SUBMITTED
        : StandupEntryStatus.DRAFT;

    const entry = await this.prisma.standupEntry.upsert({
      where: {
        teamId_userId_entryDate: { teamId, userId, entryDate },
      },
      create: {
        teamId,
        userId,
        entryDate,
        status,
        yesterday: body.yesterday,
        today: body.today,
        blockers: body.blockers,
        submittedAt:
          status === StandupEntryStatus.SUBMITTED ? new Date() : null,
      },
      update: {
        status,
        yesterday: body.yesterday,
        today: body.today,
        blockers: body.blockers,
        submittedAt:
          status === StandupEntryStatus.SUBMITTED ? new Date() : null,
      },
    });

    if (status === StandupEntryStatus.SUBMITTED) {
      try {
        await this.rebuildSummaryForDate(teamId, entryDate);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Auto-rebuild summary failed for team ${teamId}: ${message}`,
        );
      }
    }

    return this.toEntryDto(entry);
  }

  async listForTeam(
    teamId: string,
    user: VerifiedUser,
    dateStr?: string,
  ): Promise<StandupEntryDto[]> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamAdmin(teamId, userId);
    const entryDate = await this.resolveEntryDate(teamId, dateStr);

    const entries = await this.prisma.standupEntry.findMany({
      where: { teamId, entryDate },
      orderBy: { updatedAt: 'desc' },
    });
    return entries.map((e) => this.toEntryDto(e));
  }

  async getSummary(
    teamId: string,
    user: VerifiedUser,
    dateStr?: string,
  ): Promise<StandupSummaryDto | null> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamMember(teamId, userId);
    const entryDate = await this.resolveEntryDate(teamId, dateStr);

    const summary = await this.prisma.standupSummary.findUnique({
      where: { teamId_entryDate: { teamId, entryDate } },
    });
    if (!summary) {
      return null;
    }
    return {
      id: summary.id,
      teamId: summary.teamId,
      entryDate: summary.entryDate.toISOString().slice(0, 10),
      content: summary.content,
    };
  }

  async rebuildSummary(
    teamId: string,
    user: VerifiedUser,
    dateStr?: string,
  ): Promise<StandupSummaryDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamAdmin(teamId, userId);
    const entryDate = await this.resolveEntryDate(teamId, dateStr);
    return this.rebuildSummaryForDate(teamId, entryDate);
  }

  private classicMarkdownSummary(
    entries: Array<{
      userId: string;
      yesterday: string | null;
      today: string | null;
      blockers: string | null;
      user: {
        displayName: string | null;
        email: string | null;
      };
    }>,
  ): string {
    const lines = entries.map((e) => {
      const who = e.user.displayName || e.user.email || e.userId;
      return [
        `### ${who}`,
        e.yesterday ? `- Yesterday: ${e.yesterday}` : null,
        e.today ? `- Today: ${e.today}` : null,
        e.blockers ? `- Blockers: ${e.blockers}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    });

    return lines.length > 0
      ? lines.join('\n\n')
      : 'No submitted standups for this day yet.';
  }

  private asDigestDelivery(raw: unknown): {
    content?: string;
    providers: {
      slack?: boolean;
      teams?: boolean;
      linear?: boolean;
      github?: boolean;
      jira?: boolean;
    };
  } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { providers: {} };
    }
    const obj = raw as Record<string, unknown>;
    const content =
      typeof obj['content'] === 'string' ? obj['content'] : undefined;
    const providersRaw = obj['providers'];
    const providers: {
      slack?: boolean;
      teams?: boolean;
      linear?: boolean;
      github?: boolean;
      jira?: boolean;
    } = {};
    if (
      providersRaw &&
      typeof providersRaw === 'object' &&
      !Array.isArray(providersRaw)
    ) {
      const p = providersRaw as Record<string, unknown>;
      for (const key of [
        'slack',
        'teams',
        'linear',
        'github',
        'jira',
      ] as const) {
        if (p[key] === true) {
          providers[key] = true;
        }
      }
    }
    return { content, providers };
  }

  private async rebuildSummaryForDate(
    teamId: string,
    entryDate: Date,
  ): Promise<StandupSummaryDto> {
    const entries = await this.prisma.standupEntry.findMany({
      where: {
        teamId,
        entryDate,
        status: StandupEntryStatus.SUBMITTED,
      },
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });

    const entryDateIso = entryDate.toISOString().slice(0, 10);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { workspaceId: true, name: true },
    });
    const teamName = team?.name?.trim() || 'Team';

    const classic = this.classicMarkdownSummary(entries);
    const aiMarkdown = await this.ai.summarizeStandup({
      teamName,
      entryDate: entryDateIso,
      entries: entries.map((e) => ({
        displayName: e.user.displayName || e.user.email || e.userId,
        yesterday: e.yesterday,
        today: e.today,
        blockers: e.blockers,
      })),
    });
    const content = aiMarkdown ?? classic;

    const prior = await this.prisma.standupSummary.findUnique({
      where: { teamId_entryDate: { teamId, entryDate } },
      select: { digestDeliveryJson: true },
    });
    const priorDelivery = this.asDigestDelivery(prior?.digestDeliveryJson);
    const contentUnchanged = priorDelivery.content === content;
    const providers = contentUnchanged ? { ...priorDelivery.providers } : {};

    const summary = await this.prisma.standupSummary.upsert({
      where: { teamId_entryDate: { teamId, entryDate } },
      create: { teamId, entryDate, content },
      update: { content },
    });

    try {
      if (team) {
        const digest = {
          workspaceId: team.workspaceId,
          teamId,
          teamName: team.name,
          entryDate: entryDateIso,
          content: summary.content,
        };
        if (!providers.slack) {
          providers.slack = await this.slack.postStandupDigest(digest);
        }
        if (!providers.teams) {
          providers.teams = await this.msTeams.postStandupDigest(digest);
        }
        if (!providers.linear) {
          providers.linear = await this.linear.postStandupDigest(digest);
        }
        if (!providers.github) {
          providers.github = await this.github.postStandupDigest(digest);
        }
        if (!providers.jira) {
          providers.jira = await this.jira.postStandupDigest(digest);
        }

        await this.prisma.standupSummary.update({
          where: { id: summary.id },
          data: {
            digestDeliveryJson: {
              content: summary.content,
              providers,
            },
          },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Digest after summary rebuild failed for team ${teamId}: ${message}`,
      );
    }

    return {
      id: summary.id,
      teamId: summary.teamId,
      entryDate: summary.entryDate.toISOString().slice(0, 10),
      content: summary.content,
    };
  }
}
