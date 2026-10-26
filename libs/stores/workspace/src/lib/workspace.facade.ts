import { inject, Injectable } from '@angular/core';
import type {
  TeamDto,
  WorkspaceDto,
  WorkspaceToolDto,
} from '@silvervibe/shared/api-client';
import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';
import type {
  CreateTeamInput,
  CreateWorkspaceInput,
  SelectTeamsChannelInput,
  SlackConnectionView,
  SlackOAuthStartView,
  TeamsConnectionView,
  TeamsGraphChannelView,
  TeamsGraphTeamView,
  TeamsOAuthStartView,
  WorkspaceMembershipView,
  WorkspaceToolView,
} from './workspace.models';
import { WorkspaceService } from './workspace.service';
import { WorkspaceStore } from './workspace.store';

/**
 * Public API for workspace memberships, selection, and admin mutations.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceFacade {
  private readonly store = inject(WorkspaceStore);
  private readonly api = inject(WorkspaceService);

  readonly memberships = this.store.memberships;
  readonly selectedWorkspaceId = this.store.selectedWorkspaceId;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMyWorkspaces(): Promise<void> {
    return this.store.loadMyWorkspaces();
  }

  selectWorkspace(workspaceId: string): void {
    this.store.selectWorkspace(workspaceId);
  }

  selectedWorkspace(): WorkspaceMembershipView | null {
    return this.store.selectedWorkspace();
  }

  enabledTools(): WorkspaceToolView[] {
    return this.store.enabledTools();
  }

  effectiveWorkspaceRole(): PreviewWorkspaceRole | null {
    return this.store.effectiveWorkspaceRole();
  }

  isWorkspaceAdmin(): boolean {
    return this.store.isWorkspaceAdmin();
  }

  async createWorkspace(body: CreateWorkspaceInput): Promise<WorkspaceDto> {
    const workspace = await this.api.createWorkspace(body);
    await this.store.loadMyWorkspaces();
    this.store.selectWorkspace(workspace.id);
    return workspace;
  }

  setToolEntitlement(
    workspaceId: string,
    toolKey: string,
    enabled: boolean,
  ): Promise<WorkspaceToolDto> {
    return this.api.setToolEntitlement(workspaceId, toolKey, enabled);
  }

  createTeam(workspaceId: string, body: CreateTeamInput): Promise<TeamDto> {
    return this.api.createTeam(workspaceId, body);
  }

  getSlackConnection(workspaceId: string): Promise<SlackConnectionView> {
    return this.api.getSlackConnection(workspaceId);
  }

  startSlackOAuth(workspaceId: string): Promise<SlackOAuthStartView> {
    return this.api.startSlackOAuth(workspaceId);
  }

  disconnectSlack(workspaceId: string): Promise<SlackConnectionView> {
    return this.api.disconnectSlack(workspaceId);
  }

  getTeamsConnection(workspaceId: string): Promise<TeamsConnectionView> {
    return this.api.getTeamsConnection(workspaceId);
  }

  startTeamsOAuth(workspaceId: string): Promise<TeamsOAuthStartView> {
    return this.api.startTeamsOAuth(workspaceId);
  }

  listTeamsJoined(workspaceId: string): Promise<TeamsGraphTeamView[]> {
    return this.api.listTeamsJoined(workspaceId);
  }

  listTeamsChannels(
    workspaceId: string,
    teamId: string,
  ): Promise<TeamsGraphChannelView[]> {
    return this.api.listTeamsChannels(workspaceId, teamId);
  }

  selectTeamsChannel(
    workspaceId: string,
    body: SelectTeamsChannelInput,
  ): Promise<TeamsConnectionView> {
    return this.api.selectTeamsChannel(workspaceId, body);
  }

  disconnectTeams(workspaceId: string): Promise<TeamsConnectionView> {
    return this.api.disconnectTeams(workspaceId);
  }
}
