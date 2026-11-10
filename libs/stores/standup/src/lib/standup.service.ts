import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  CreateTeamInviteDtoRoleEnum,
  MyTeamDtoRoleEnum,
  StandupEntryDtoStatusEnum,
  TeamInviteDtoStatusEnum,
  UpsertStandupEntryDtoStatusEnum,
  type MyTeamDto,
  type StandupConfigDto,
  type StandupEntryDto,
  type StandupSummaryDto,
  type UpdateStandupConfigDto,
  type UpsertStandupEntryDto,
  type TeamInviteDto,
  type TeamMemberDto,
} from '@silvervibe/shared/api-client';
import { StandupsDataService } from '@silvervibe/shared/api-client/api/standups-data.service';
import { TeamsDataService } from '@silvervibe/shared/api-client/api/teams-data.service';
import { firstValueFrom } from 'rxjs';
import { weekFromUnknown } from './member-clock';
import type { MentionIssueView } from './mentions';
import type {
  StandupAnswerValue,
  StandupAnswersInput,
  StandupConfigInput,
  StandupConfigView,
  StandupEntryView,
  StandupQuestion,
  StandupRecentDay,
  StandupRosterMember,
  StandupSummaryView,
  TeamInviteView,
  TeamMemberView,
  TeamView,
} from './standup.models';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return null;
  }
  return String(value);
}

function asQuestions(value: object | null | undefined): StandupQuestion[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is StandupQuestion =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as StandupQuestion).id === 'string' &&
        typeof (item as StandupQuestion).prompt === 'string',
    );
  }
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const prompt = (key: string, fallback: string) =>
    typeof record[key] === 'string' ? (record[key] as string) : fallback;
  return [
    {
      id: 'yesterday',
      type: 'text',
      prompt: prompt('yesterday', 'What did you do yesterday?'),
      enabled: true,
      required: true,
      builtin: 'yesterday',
    },
    {
      id: 'today',
      type: 'text',
      prompt: prompt('today', 'What will you do today?'),
      enabled: true,
      required: true,
      builtin: 'today',
    },
    {
      id: 'blockers',
      type: 'text',
      prompt: prompt('blockers', 'Any blockers?'),
      enabled: true,
      required: false,
      builtin: 'blockers',
    },
    {
      id: 'location',
      type: 'choice',
      prompt: 'Where are you working today?',
      enabled: false,
      required: false,
      builtin: 'location',
      allowOther: true,
      options: [
        { id: 'office', label: 'Office' },
        { id: 'remote', label: 'Remote' },
      ],
    },
    {
      id: 'hours',
      type: 'text',
      prompt: 'Hours available today',
      enabled: false,
      required: false,
      builtin: 'hours',
    },
  ];
}

function asAnswers(value: unknown): Record<string, StandupAnswerValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const answers: Record<string, StandupAnswerValue> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }
    const row = raw as Record<string, unknown>;
    answers[key] = {
      ...(typeof row['text'] === 'string' ? { text: row['text'] } : {}),
      ...(typeof row['optionId'] === 'string'
        ? { optionId: row['optionId'] }
        : {}),
      ...(typeof row['otherText'] === 'string'
        ? { otherText: row['otherText'] }
        : {}),
      ...(typeof row['helpFrom'] === 'string' && row['helpFrom'].trim()
        ? { helpFrom: row['helpFrom'] }
        : {}),
      ...(row['replyNeeded'] === 'today' ||
      row['replyNeeded'] === 'week' ||
      row['replyNeeded'] === 'none'
        ? { replyNeeded: row['replyNeeded'] }
        : {}),
    };
  }
  return answers;
}

function mapTeam(dto: MyTeamDto): TeamView {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    role: dto.role === MyTeamDtoRoleEnum.ADMIN ? 'ADMIN' : 'MEMBER',
  };
}

function mapEntry(dto: StandupEntryDto): StandupEntryView {
  return {
    id: dto.id,
    teamId: dto.teamId,
    entryDate: dto.entryDate,
    status:
      dto.status === StandupEntryDtoStatusEnum.SUBMITTED
        ? 'SUBMITTED'
        : 'DRAFT',
    yesterday: asNullableString(dto.yesterday),
    today: asNullableString(dto.today),
    blockers: asNullableString(dto.blockers),
    answersJson: asAnswers(
      (dto as StandupEntryDto & { answersJson?: unknown }).answersJson,
    ),
  };
}

function mapSummary(dto: StandupSummaryDto): StandupSummaryView {
  return {
    id: dto.id,
    teamId: dto.teamId,
    entryDate: dto.entryDate,
    content: dto.content,
  };
}

function mapConfig(dto: StandupConfigDto): StandupConfigView {
  const extra = dto as StandupConfigDto & {
    scheduleKind?: string;
    windowStartHour?: number;
    windowStartMinute?: number;
    reveal?: string;
  };
  return {
    teamId: dto.teamId,
    timezone: dto.timezone,
    reminderHour: dto.reminderHour,
    reminderMinute: dto.reminderMinute,
    scheduleKind: extra.scheduleKind === 'window' ? 'window' : 'deadline',
    windowStartHour: extra.windowStartHour ?? 8,
    windowStartMinute: extra.windowStartMinute ?? 0,
    reveal: extra.reveal === 'together' ? 'together' : 'live',
    questionsJson: asQuestions(dto.questionsJson),
  };
}

function mapMember(dto: TeamMemberDto): TeamMemberView {
  return {
    id: dto.id,
    userId: dto.userId,
    role: dto.role,
    email: asNullableString(dto.email),
    displayName: asNullableString(dto.displayName),
    timezone:
      (dto as TeamMemberDto & { timezone?: string }).timezone?.trim() || 'UTC',
    workHours: weekFromUnknown(
      (dto as TeamMemberDto & { workHoursJson?: unknown }).workHoursJson,
    ),
  };
}

function mapInviteStatus(
  status: TeamInviteDtoStatusEnum,
): TeamInviteView['status'] {
  if (status === TeamInviteDtoStatusEnum.ACCEPTED) {
    return 'ACCEPTED';
  }
  if (status === TeamInviteDtoStatusEnum.REVOKED) {
    return 'REVOKED';
  }
  return 'PENDING';
}

function mapInvite(dto: TeamInviteDto): TeamInviteView {
  return {
    id: dto.id,
    teamId: dto.teamId,
    email: dto.email,
    role: dto.role,
    status: mapInviteStatus(dto.status),
    token: dto.token,
    acceptPath: dto.acceptPath,
    expiresAt: dto.expiresAt,
    member: dto.member ? mapMember(dto.member) : undefined,
    emailSent: dto.emailSent,
    emailError: dto.emailError,
  };
}

@Injectable({ providedIn: 'root' })
export class StandupService {
  private readonly standupsApi = inject(StandupsDataService);
  private readonly teamsApi = inject(TeamsDataService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  async listMyTeams(workspaceId: string): Promise<TeamView[]> {
    const rows = await firstValueFrom(
      this.teamsApi.teamsControllerListMine({ workspaceId }),
    );
    return rows.map(mapTeam);
  }

  async getTodayEntry(teamId: string): Promise<StandupEntryView> {
    const dto = await firstValueFrom(
      this.standupsApi.standupsControllerGetMine({
        teamId,
        date: todayIsoDate(),
      }),
    );
    return mapEntry(dto);
  }

  async getTodaySummary(teamId: string): Promise<StandupSummaryView | null> {
    try {
      const dto = await firstValueFrom(
        this.standupsApi.standupsControllerGetSummary({
          teamId,
          date: todayIsoDate(),
        }),
      );
      return dto ? mapSummary(dto) : null;
    } catch {
      return null;
    }
  }

  async getConfig(teamId: string): Promise<StandupConfigView> {
    const dto = await firstValueFrom(
      this.standupsApi.standupsControllerGetConfig({ teamId }),
    );
    return mapConfig(dto);
  }

  async upsertMine(
    teamId: string,
    body: StandupAnswersInput,
    status: 'DRAFT' | 'SUBMITTED',
  ): Promise<StandupEntryView> {
    const dto = await firstValueFrom(
      this.standupsApi.standupsControllerUpsertMine({
        teamId,
        date: todayIsoDate(),
        upsertStandupEntryDto: {
          yesterday: body.yesterday,
          today: body.today,
          blockers: body.blockers,
          answers: body.answers,
          status:
            status === 'SUBMITTED'
              ? UpsertStandupEntryDtoStatusEnum.SUBMITTED
              : UpsertStandupEntryDtoStatusEnum.DRAFT,
        } as UpsertStandupEntryDto,
      }),
    );
    return mapEntry(dto);
  }

  async listAwayDates(teamId: string): Promise<string[]> {
    const body = await firstValueFrom(
      this.http.get<{ dates: string[] }>(
        `${this.apiBase}/teams/${teamId}/standups/away`,
      ),
    );
    return body.dates ?? [];
  }

  async setAway(
    teamId: string,
    date: string,
    away: boolean,
  ): Promise<string[]> {
    const body = await firstValueFrom(
      this.http.put<{ dates: string[] }>(
        `${this.apiBase}/teams/${teamId}/standups/away`,
        { date, away },
      ),
    );
    return body.dates ?? [];
  }

  async listRecentWork(teamId: string): Promise<MentionIssueView[]> {
    return firstValueFrom(
      this.http.get<MentionIssueView[]>(
        `${this.apiBase}/teams/${teamId}/mentions/recent`,
      ),
    );
  }

  async listRecentSummaries(teamId: string): Promise<StandupRecentDay[]> {
    return firstValueFrom(
      this.http.get<StandupRecentDay[]>(
        `${this.apiBase}/teams/${teamId}/standups/recent`,
      ),
    );
  }

  async listRoster(teamId: string): Promise<StandupRosterMember[]> {
    return firstValueFrom(
      this.http.get<StandupRosterMember[]>(
        `${this.apiBase}/teams/${teamId}/standups/roster`,
      ),
    );
  }

  async listTodayEntries(teamId: string): Promise<StandupEntryView[]> {
    const rows = await firstValueFrom(
      this.standupsApi.standupsControllerList({
        teamId,
        date: todayIsoDate(),
      }),
    );
    return rows.map(mapEntry);
  }

  async updateConfig(
    teamId: string,
    body: StandupConfigInput,
  ): Promise<StandupConfigView> {
    const dto = await firstValueFrom(
      this.standupsApi.standupsControllerUpdateConfig({
        teamId,
        updateStandupConfigDto: {
          timezone: body.timezone,
          reminderHour: body.reminderHour,
          reminderMinute: body.reminderMinute,
          scheduleKind: body.scheduleKind,
          windowStartHour: body.windowStartHour,
          windowStartMinute: body.windowStartMinute,
          reveal: body.reveal,
          questionsJson: body.questionsJson,
        } as unknown as UpdateStandupConfigDto,
      }),
    );
    return mapConfig(dto);
  }

  async rebuildSummary(teamId: string): Promise<StandupSummaryView> {
    const dto = await firstValueFrom(
      this.standupsApi.standupsControllerRebuildSummary({
        teamId,
        date: todayIsoDate(),
      }),
    );
    return mapSummary(dto);
  }

  async searchIssues(
    teamId: string,
    query: string,
  ): Promise<MentionIssueView[]> {
    const rows = await firstValueFrom(
      this.http.get<MentionIssueView[]>(
        `${this.apiBase}/teams/${encodeURIComponent(teamId)}/mentions/issues`,
        { params: { q: query } },
      ),
    );
    return (Array.isArray(rows) ? rows : []).filter(
      (row): row is MentionIssueView =>
        !!row &&
        (row.provider === 'github' ||
          row.provider === 'gitlab' ||
          row.provider === 'jira' ||
          row.provider === 'linear') &&
        typeof row.key === 'string' &&
        typeof row.title === 'string' &&
        typeof row.url === 'string' &&
        row.url.startsWith('https://'),
    );
  }

  async listMembers(teamId: string): Promise<TeamMemberView[]> {
    const rows = await firstValueFrom(
      this.teamsApi.teamsControllerListMembers({ teamId }),
    );
    return rows.map(mapMember);
  }

  async inviteByEmail(teamId: string, email: string): Promise<TeamInviteView> {
    const dto = await firstValueFrom(
      this.teamsApi.teamsControllerCreateInvite({
        teamId,
        createTeamInviteDto: {
          email,
          role: CreateTeamInviteDtoRoleEnum.MEMBER,
        },
      }),
    );
    return mapInvite(dto);
  }

  async listInvites(teamId: string): Promise<TeamInviteView[]> {
    const rows = await firstValueFrom(
      this.teamsApi.teamsControllerListInvites({ teamId }),
    );
    return rows.map(mapInvite);
  }

  async revokeInvite(
    teamId: string,
    inviteId: string,
  ): Promise<TeamInviteView> {
    const dto = await firstValueFrom(
      this.teamsApi.teamsControllerRevokeInvite({ teamId, inviteId }),
    );
    return mapInvite(dto);
  }

  async acceptInvite(token: string): Promise<{
    teamId: string;
    workspaceId: string;
    member: TeamMemberView;
  }> {
    const dto = await firstValueFrom(
      this.teamsApi.teamsControllerAcceptInvite({ token }),
    );
    return {
      teamId: dto.teamId,
      workspaceId: dto.workspaceId,
      member: mapMember(dto.member),
    };
  }
}
