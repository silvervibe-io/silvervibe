import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { StandupEntryStatus } from '@prisma/client';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly teams: TeamsService,
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
      questionsJson: config.questionsJson as Record<string, string>,
    };
  }

  async updateConfig(
    teamId: string,
    user: VerifiedUser,
    timezone: string,
    questionsJson: Record<string, string>,
  ): Promise<StandupConfigDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.teams.requireTeamAdmin(teamId, userId);

    const config = await this.prisma.standupConfig.upsert({
      where: { teamId },
      create: { teamId, timezone, questionsJson },
      update: { timezone, questionsJson },
    });

    return {
      teamId,
      timezone: config.timezone,
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

    const entries = await this.prisma.standupEntry.findMany({
      where: {
        teamId,
        entryDate,
        status: StandupEntryStatus.SUBMITTED,
      },
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });

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

    const content =
      lines.length > 0
        ? lines.join('\n\n')
        : 'No submitted standups for this day yet.';

    const summary = await this.prisma.standupSummary.upsert({
      where: { teamId_entryDate: { teamId, entryDate } },
      create: { teamId, entryDate, content },
      update: { content },
    });

    return {
      id: summary.id,
      teamId: summary.teamId,
      entryDate: summary.entryDate.toISOString().slice(0, 10),
      content: summary.content,
    };
  }
}
