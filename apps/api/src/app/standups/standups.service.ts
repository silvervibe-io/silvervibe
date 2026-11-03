import {
  BadRequestException,
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
import {
  answerDisplay,
  answersAreComplete,
  answersFromStorage,
  mirrorBuiltinColumns,
  questionsForSave,
  questionsFromStorage,
  StandupQuestionError,
  type StandupAnswer,
  type StandupQuestion,
} from './standup-questions';
import {
  assertSchedule,
  isCollectionSlot,
  isRevealed,
  scheduleFromConfig,
  submissionPhase,
} from './standup-schedule';

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
    answersJson?: unknown;
  }): StandupEntryDto {
    return {
      id: entry.id,
      teamId: entry.teamId,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      status: entry.status,
      yesterday: entry.yesterday,
      today: entry.today,
      blockers: entry.blockers,
      answersJson: answersFromStorage(entry.answersJson),
    };
  }

  private toConfigDto(
    teamId: string,
    config: {
      timezone: string;
      reminderHour: number;
      reminderMinute: number;
      scheduleKind?: string | null;
      windowStartHour?: number | null;
      windowStartMinute?: number | null;
      reveal?: string | null;
      questionsJson: unknown;
    },
  ): StandupConfigDto {
    const schedule = scheduleFromConfig(config);
    return {
      teamId,
      timezone: schedule.timezone,
      reminderHour: schedule.endHour,
      reminderMinute: schedule.endMinute,
      scheduleKind: schedule.scheduleKind,
      windowStartHour: schedule.windowStartHour,
      windowStartMinute: schedule.windowStartMinute,
      reveal: schedule.reveal,
      questionsJson: questionsFromStorage(config.questionsJson),
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

    return this.toConfigDto(teamId, config);
  }

  async updateConfig(
    teamId: string,
    user: VerifiedUser,
    body: {
      timezone: string;
      reminderHour: number;
      reminderMinute: number;
      scheduleKind: 'deadline' | 'window';
      windowStartHour: number;
      windowStartMinute: number;
      reveal: 'live' | 'together';
      questionsJson: unknown;
    },
  ): Promise<StandupConfigDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamAdmin(teamId, userId);
    try {
      assertSchedule({
        timezone: body.timezone,
        scheduleKind: body.scheduleKind,
        windowStartHour: body.windowStartHour,
        windowStartMinute: body.windowStartMinute,
        endHour: body.reminderHour,
        endMinute: body.reminderMinute,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'standup.window';
      throw new BadRequestException(message);
    }
    let questionsJson;
    try {
      questionsJson = questionsForSave(body.questionsJson);
    } catch (err: unknown) {
      if (err instanceof StandupQuestionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const config = await this.prisma.standupConfig.upsert({
      where: { teamId },
      create: {
        teamId,
        timezone: body.timezone.trim(),
        reminderHour: body.reminderHour,
        reminderMinute: body.reminderMinute,
        scheduleKind: body.scheduleKind === 'window' ? 'WINDOW' : 'DEADLINE',
        windowStartHour: body.windowStartHour,
        windowStartMinute: body.windowStartMinute,
        reveal: body.reveal === 'together' ? 'TOGETHER' : 'LIVE',
        questionsJson,
      },
      update: {
        timezone: body.timezone.trim(),
        reminderHour: body.reminderHour,
        reminderMinute: body.reminderMinute,
        scheduleKind: body.scheduleKind === 'window' ? 'WINDOW' : 'DEADLINE',
        windowStartHour: body.windowStartHour,
        windowStartMinute: body.windowStartMinute,
        reveal: body.reveal === 'together' ? 'TOGETHER' : 'LIVE',
        questionsJson,
      },
    });

    return this.toConfigDto(teamId, config);
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
    const stored = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    const schedule = scheduleFromConfig(stored);
    const phase = submissionPhase(schedule);
    if (phase !== 'open') {
      throw new BadRequestException(
        phase === 'before' ? 'standup.notOpen' : 'standup.closed',
      );
    }
    const questions = questionsFromStorage(stored?.questionsJson);
    const answers = this.entryAnswers(body, questions);
    const status =
      body.status === 'SUBMITTED'
        ? StandupEntryStatus.SUBMITTED
        : StandupEntryStatus.DRAFT;
    if (
      status === StandupEntryStatus.SUBMITTED &&
      !answersAreComplete(questions, answers)
    ) {
      throw new BadRequestException('standup.answers');
    }
    const mirrored = mirrorBuiltinColumns(questions, answers);
    const entryDate = dateStr?.trim()
      ? parseCalendarDate(dateStr)
      : parseCalendarDate(calendarDateInTimezone(schedule.timezone));

    const entry = await this.prisma.standupEntry.upsert({
      where: {
        teamId_userId_entryDate: { teamId, userId, entryDate },
      },
      create: {
        teamId,
        userId,
        entryDate,
        status,
        yesterday: mirrored.yesterday,
        today: mirrored.today,
        blockers: mirrored.blockers,
        answersJson: answers,
        submittedAt:
          status === StandupEntryStatus.SUBMITTED ? new Date() : null,
      },
      update: {
        status,
        yesterday: mirrored.yesterday,
        today: mirrored.today,
        blockers: mirrored.blockers,
        answersJson: answers,
        submittedAt:
          status === StandupEntryStatus.SUBMITTED ? new Date() : null,
      },
    });

    if (status === StandupEntryStatus.SUBMITTED && isRevealed(schedule)) {
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
    const membership = await this.teams.requireTeamMember(teamId, userId);
    const stored = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    const schedule = scheduleFromConfig(stored);
    if (!isRevealed(schedule) && membership.role !== 'ADMIN') {
      return null;
    }
    const entryDate = dateStr?.trim()
      ? parseCalendarDate(dateStr)
      : parseCalendarDate(calendarDateInTimezone(schedule.timezone));

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

  private entryAnswers(
    body: UpsertStandupEntryDto,
    questions: StandupQuestion[],
  ): Record<string, StandupAnswer> {
    const stored = answersFromStorage(body.answers);
    if (Object.keys(stored).length > 0) {
      return stored;
    }
    const answers: Record<string, StandupAnswer> = {};
    for (const question of questions) {
      if (question.builtin === 'yesterday') {
        answers[question.id] = { text: body.yesterday };
      } else if (question.builtin === 'today') {
        answers[question.id] = { text: body.today };
      } else if (question.builtin === 'blockers') {
        answers[question.id] = { text: body.blockers };
      }
    }
    return answers;
  }

  private classicMarkdownSummary(
    entries: Array<{
      userId: string;
      yesterday: string | null;
      today: string | null;
      blockers: string | null;
      answersJson?: unknown;
      user: {
        displayName: string | null;
        email: string | null;
      };
    }>,
    questions: StandupQuestion[],
  ): string {
    const lines = entries.map((e) => {
      const who = e.user.displayName || e.user.email || e.userId;
      const answers = answersFromStorage(e.answersJson);
      const answered = Object.keys(answers).length > 0;
      const detail = answered
        ? questions
            .filter((question) => question.enabled)
            .map((question) => {
              const value = answerDisplay(question, answers[question.id]);
              return value ? `- ${question.prompt}: ${value}` : null;
            })
        : [
            e.yesterday ? `- Yesterday: ${e.yesterday}` : null,
            e.today ? `- Today: ${e.today}` : null,
            e.blockers ? `- Blockers: ${e.blockers}` : null,
          ];
      return [`### ${who}`, ...detail].filter(Boolean).join('\n');
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
    const storedConfig = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    const questions = questionsFromStorage(storedConfig?.questionsJson);

    const classic = this.classicMarkdownSummary(entries, questions);
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

  /** Build and deliver the summary once the standup time has arrived. */
  async publishTogether(teamId: string, now: Date): Promise<void> {
    this.ensureDb();
    const stored = await this.prisma.standupConfig.findUnique({
      where: { teamId },
    });
    const schedule = scheduleFromConfig(stored);
    if (schedule.reveal !== 'together' || !isCollectionSlot(schedule, now)) {
      return;
    }
    const entryDate = parseCalendarDate(
      calendarDateInTimezone(schedule.timezone, now),
    );
    await this.rebuildSummaryForDate(teamId, entryDate);
  }
}
