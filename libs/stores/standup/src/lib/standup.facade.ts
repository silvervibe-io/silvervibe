import { inject, Injectable } from '@angular/core';
import type { TeamMemberDto } from '@silvervibe/shared/api-client';
import type {
  StandupAnswersInput,
  StandupConfigInput,
  TeamMemberView,
} from './standup.models';
import { StandupService } from './standup.service';
import { StandupStore } from './standup.store';

/**
 * Public API for standup teams, daily entry, config, and member invites.
 */
@Injectable({ providedIn: 'root' })
export class StandupFacade {
  private readonly store = inject(StandupStore);
  private readonly api = inject(StandupService);

  readonly teams = this.store.teams;
  readonly selectedTeamId = this.store.selectedTeamId;
  readonly entry = this.store.entry;
  readonly summary = this.store.summary;
  readonly config = this.store.config;
  readonly teamEntries = this.store.teamEntries;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMyTeams(workspaceId: string): Promise<void> {
    return this.store.loadMyTeams(workspaceId);
  }

  selectTeam(teamId: string): void {
    this.store.selectTeam(teamId);
  }

  isTeamAdmin(): boolean {
    return this.store.isTeamAdmin();
  }

  loadToday(teamId: string): Promise<void> {
    return this.store.loadToday(teamId);
  }

  saveDraft(teamId: string, body: StandupAnswersInput): Promise<void> {
    return this.store.saveDraft(teamId, body);
  }

  submit(teamId: string, body: StandupAnswersInput): Promise<void> {
    return this.store.submit(teamId, body);
  }

  loadTeamAdmin(teamId: string): Promise<void> {
    return this.store.loadTeamAdmin(teamId);
  }

  saveConfig(teamId: string, body: StandupConfigInput): Promise<void> {
    return this.store.saveConfig(teamId, body);
  }

  refreshSummary(teamId: string): Promise<void> {
    return this.store.refreshSummary(teamId);
  }

  listMembers(teamId: string): Promise<TeamMemberView[]> {
    return this.api.listMembers(teamId);
  }

  inviteMember(teamId: string, userId: string): Promise<TeamMemberDto> {
    return this.api.inviteMember(teamId, userId);
  }
}
