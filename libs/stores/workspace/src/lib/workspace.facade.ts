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
  GithubConnectionView,
  GithubIssueView,
  GithubOAuthStartView,
  GithubRepoView,
  JiraConnectionView,
  JiraIssueView,
  JiraOAuthStartView,
  JiraProjectView,
  JiraSiteView,
  LinearConnectionView,
  LinearOAuthStartView,
  LinearProjectView,
  SelectGithubTargetInput,
  SelectJiraSiteInput,
  SelectJiraTargetInput,
  SelectLinearProjectInput,
  SetTeamGithubTargetInput,
  SetTeamJiraTargetInput,
  SetTeamLinearProjectInput,
  SetTeamSlackChannelInput,
  SlackChannelOptionView,
  SlackConnectionView,
  SlackOAuthStartView,
  TeamGithubTargetView,
  TeamJiraTargetView,
  TeamLinearProjectView,
  TeamSlackChannelView,
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

  async setWorkspacePlan(
    workspaceId: string,
    planKey: 'free' | 'team',
  ): Promise<WorkspaceDto> {
    const workspace = await this.api.setWorkspacePlan(workspaceId, planKey);
    await this.store.loadMyWorkspaces();
    this.store.selectWorkspace(workspaceId);
    return workspace;
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

  listTeamSlackChannels(teamId: string): Promise<SlackChannelOptionView[]> {
    return this.api.listTeamSlackChannels(teamId);
  }

  getTeamSlackChannel(teamId: string): Promise<TeamSlackChannelView> {
    return this.api.getTeamSlackChannel(teamId);
  }

  setTeamSlackChannel(
    teamId: string,
    body: SetTeamSlackChannelInput,
  ): Promise<TeamSlackChannelView> {
    return this.api.setTeamSlackChannel(teamId, body);
  }

  clearTeamSlackChannel(teamId: string): Promise<TeamSlackChannelView> {
    return this.api.clearTeamSlackChannel(teamId);
  }

  listTeamLinearProjects(teamId: string): Promise<LinearProjectView[]> {
    return this.api.listTeamLinearProjects(teamId);
  }

  getTeamLinearProject(teamId: string): Promise<TeamLinearProjectView> {
    return this.api.getTeamLinearProject(teamId);
  }

  setTeamLinearProject(
    teamId: string,
    body: SetTeamLinearProjectInput,
  ): Promise<TeamLinearProjectView> {
    return this.api.setTeamLinearProject(teamId, body);
  }

  clearTeamLinearProject(teamId: string): Promise<TeamLinearProjectView> {
    return this.api.clearTeamLinearProject(teamId);
  }

  listTeamGithubRepos(teamId: string): Promise<GithubRepoView[]> {
    return this.api.listTeamGithubRepos(teamId);
  }

  listTeamGithubIssues(
    teamId: string,
    owner: string,
    repo: string,
  ): Promise<GithubIssueView[]> {
    return this.api.listTeamGithubIssues(teamId, owner, repo);
  }

  getTeamGithubTarget(teamId: string): Promise<TeamGithubTargetView> {
    return this.api.getTeamGithubTarget(teamId);
  }

  setTeamGithubTarget(
    teamId: string,
    body: SetTeamGithubTargetInput,
  ): Promise<TeamGithubTargetView> {
    return this.api.setTeamGithubTarget(teamId, body);
  }

  clearTeamGithubTarget(teamId: string): Promise<TeamGithubTargetView> {
    return this.api.clearTeamGithubTarget(teamId);
  }

  listTeamJiraSites(teamId: string): Promise<JiraSiteView[]> {
    return this.api.listTeamJiraSites(teamId);
  }

  listTeamJiraProjects(
    teamId: string,
    cloudId?: string,
  ): Promise<JiraProjectView[]> {
    return this.api.listTeamJiraProjects(teamId, cloudId);
  }

  listTeamJiraIssues(
    teamId: string,
    projectKey: string,
    cloudId?: string,
  ): Promise<JiraIssueView[]> {
    return this.api.listTeamJiraIssues(teamId, projectKey, cloudId);
  }

  getTeamJiraTarget(teamId: string): Promise<TeamJiraTargetView> {
    return this.api.getTeamJiraTarget(teamId);
  }

  setTeamJiraTarget(
    teamId: string,
    body: SetTeamJiraTargetInput,
  ): Promise<TeamJiraTargetView> {
    return this.api.setTeamJiraTarget(teamId, body);
  }

  clearTeamJiraTarget(teamId: string): Promise<TeamJiraTargetView> {
    return this.api.clearTeamJiraTarget(teamId);
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

  getGithubConnection(workspaceId: string): Promise<GithubConnectionView> {
    return this.api.getGithubConnection(workspaceId);
  }

  startGithubOAuth(workspaceId: string): Promise<GithubOAuthStartView> {
    return this.api.startGithubOAuth(workspaceId);
  }

  listGithubRepos(workspaceId: string): Promise<GithubRepoView[]> {
    return this.api.listGithubRepos(workspaceId);
  }

  listGithubIssues(
    workspaceId: string,
    owner: string,
    repo: string,
  ): Promise<GithubIssueView[]> {
    return this.api.listGithubIssues(workspaceId, owner, repo);
  }

  selectGithubTarget(
    workspaceId: string,
    body: SelectGithubTargetInput,
  ): Promise<GithubConnectionView> {
    return this.api.selectGithubTarget(workspaceId, body);
  }

  disconnectGithub(workspaceId: string): Promise<GithubConnectionView> {
    return this.api.disconnectGithub(workspaceId);
  }

  getJiraConnection(workspaceId: string): Promise<JiraConnectionView> {
    return this.api.getJiraConnection(workspaceId);
  }

  startJiraOAuth(workspaceId: string): Promise<JiraOAuthStartView> {
    return this.api.startJiraOAuth(workspaceId);
  }

  listJiraSites(workspaceId: string): Promise<JiraSiteView[]> {
    return this.api.listJiraSites(workspaceId);
  }

  selectJiraSite(
    workspaceId: string,
    body: SelectJiraSiteInput,
  ): Promise<JiraConnectionView> {
    return this.api.selectJiraSite(workspaceId, body);
  }

  listJiraProjects(workspaceId: string): Promise<JiraProjectView[]> {
    return this.api.listJiraProjects(workspaceId);
  }

  listJiraIssues(
    workspaceId: string,
    projectKey: string,
  ): Promise<JiraIssueView[]> {
    return this.api.listJiraIssues(workspaceId, projectKey);
  }

  selectJiraTarget(
    workspaceId: string,
    body: SelectJiraTargetInput,
  ): Promise<JiraConnectionView> {
    return this.api.selectJiraTarget(workspaceId, body);
  }

  disconnectJira(workspaceId: string): Promise<JiraConnectionView> {
    return this.api.disconnectJira(workspaceId);
  }
}
