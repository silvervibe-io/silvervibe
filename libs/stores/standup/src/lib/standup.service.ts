import { inject, Injectable } from '@angular/core';
import {
  CreateTeamInviteDtoRoleEnum,
  MyTeamDtoRoleEnum,
  StandupEntryDtoStatusEnum,
  StandupsDataService,
  TeamsDataService,
  TeamInviteDtoStatusEnum,
  UpsertStandupEntryDtoStatusEnum,
  type MyTeamDto,
  type StandupConfigDto,
  type StandupEntryDto,
  type StandupSummaryDto,
  type TeamInviteDto,
  type TeamMemberDto,
} from '@silvervibe/shared/api-client';
import { firstValueFrom } from 'rxjs';
import type {
  StandupAnswersInput,
  StandupConfigInput,
  StandupConfigView,
  StandupEntryView,
  StandupQuestions,
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

function asQuestions(value: object | null | undefined): StandupQuestions {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const q = value as Record<string, unknown>;
  return {
    yesterday: typeof q['yesterday'] === 'string' ? q['yesterday'] : undefined,
    today: typeof q['today'] === 'string' ? q['today'] : undefined,
    blockers: typeof q['blockers'] === 'string' ? q['blockers'] : undefined,
  };
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
  return {
    teamId: dto.teamId,
    timezone: dto.timezone,
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
  };
}

@Injectable({ providedIn: 'root' })
export class StandupService {
  private readonly standupsApi = inject(StandupsDataService);
  private readonly teamsApi = inject(TeamsDataService);

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
          ...body,
          status:
            status === 'SUBMITTED'
              ? UpsertStandupEntryDtoStatusEnum.SUBMITTED
              : UpsertStandupEntryDtoStatusEnum.DRAFT,
        },
      }),
    );
    return mapEntry(dto);
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
          questionsJson: body.questionsJson,
        },
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
