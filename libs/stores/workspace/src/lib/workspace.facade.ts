import { inject, Injectable } from '@angular/core';
import type {
  TeamDto,
  WorkspaceDto,
  WorkspaceToolDto,
} from '@silvervibe/shared/api-client';
import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';
import type {
  ConnectTeamsInput,
  CreateTeamInput,
  CreateWorkspaceInput,
  LinearConnectionView,
  LinearOAuthStartView,
  LinearProjectView,
  SelectLinearProjectInput,
  SlackConnectionView,
  SlackOAuthStartView,
  TeamsConnectionView,
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

  connectTeams(
    workspaceId: string,
    body: ConnectTeamsInput,
  ): Promise<TeamsConnectionView> {
    return this.api.connectTeams(workspaceId, body);
  }

  disconnectTeams(workspaceId: string): Promise<TeamsConnectionView> {
    return this.api.disconnectTeams(workspaceId);
  }

  getLinearConnection(workspaceId: string): Promise<LinearConnectionView> {
    return this.api.getLinearConnection(workspaceId);
  }

  startLinearOAuth(workspaceId: string): Promise<LinearOAuthStartView> {
    return this.api.startLinearOAuth(workspaceId);
  }

  listLinearProjects(workspaceId: string): Promise<LinearProjectView[]> {
    return this.api.listLinearProjects(workspaceId);
  }

  selectLinearProject(
    workspaceId: string,
    body: SelectLinearProjectInput,
  ): Promise<LinearConnectionView> {
    return this.api.selectLinearProject(workspaceId, body);
  }

  disconnectLinear(workspaceId: string): Promise<LinearConnectionView> {
    return this.api.disconnectLinear(workspaceId);
  }
}
