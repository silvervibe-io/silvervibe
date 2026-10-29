import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  MeWorkspaceDtoRoleEnum,
  SetWorkspacePlanDtoPlanKeyEnum,
  type CreateTeamDto,
  type CreateWorkspaceDto,
  type MeWorkspaceDto,
  type SetWorkspacePlanDto,
  type TeamDto,
  type WorkspaceDto,
  type WorkspaceToolDto,
} from '@silvervibe/shared/api-client';
import { AuthDataService } from '@silvervibe/shared/api-client/api/auth-data.service';
import { TeamsDataService } from '@silvervibe/shared/api-client/api/teams-data.service';
import { WorkspacesDataService } from '@silvervibe/shared/api-client/api/workspaces-data.service';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';
import { firstValueFrom } from 'rxjs';
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

function mapRole(role: MeWorkspaceDtoRoleEnum): PreviewWorkspaceRole {
  return role as PreviewWorkspaceRole;
}

function mapTool(tool: {
  toolKey: string;
  enabled: boolean;
}): WorkspaceToolView {
  return { toolKey: tool.toolKey, enabled: tool.enabled };
}

function mapPlanKey(raw: string | undefined | null): 'free' | 'team' {
  return raw === 'team' ? 'team' : 'free';
}

function mapMembership(dto: MeWorkspaceDto): WorkspaceMembershipView {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    planKey: mapPlanKey(dto.planKey),
    role: mapRole(dto.role),
    tools: (dto.tools ?? []).map(mapTool),
  };
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly authApi = inject(AuthDataService);
  private readonly workspacesApi = inject(WorkspacesDataService);
  private readonly teamsApi = inject(TeamsDataService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  async listMyWorkspaces(): Promise<WorkspaceMembershipView[]> {
    const rows = await firstValueFrom(
      this.authApi.usersControllerMyWorkspaces(),
    );
    return rows.map(mapMembership);
  }

  createWorkspace(body: CreateWorkspaceInput): Promise<WorkspaceDto> {
    const createWorkspaceDto: CreateWorkspaceDto = {
      name: body.name,
      slug: body.slug,
    };
    return firstValueFrom(
      this.workspacesApi.workspacesControllerCreate({ createWorkspaceDto }),
    );
  }

  setToolEntitlement(
    workspaceId: string,
    toolKey: string,
    enabled: boolean,
  ): Promise<WorkspaceToolDto> {
    return firstValueFrom(
      this.workspacesApi.workspacesControllerSetTool({
        workspaceId,
        toolKey,
        setToolEntitlementDto: { enabled },
      }),
    );
  }

  setWorkspacePlan(
    workspaceId: string,
    planKey: 'free' | 'team',
  ): Promise<WorkspaceDto> {
    const setWorkspacePlanDto: SetWorkspacePlanDto = {
      planKey:
        planKey === 'team'
          ? SetWorkspacePlanDtoPlanKeyEnum.team
          : SetWorkspacePlanDtoPlanKeyEnum.free,
    };
    return firstValueFrom(
      this.workspacesApi.workspacesControllerSetPlan({
        workspaceId,
        setWorkspacePlanDto,
      }),
    );
  }

  createTeam(workspaceId: string, body: CreateTeamInput): Promise<TeamDto> {
    const createTeamDto: CreateTeamDto = {
      name: body.name,
      slug: body.slug,
    };
    return firstValueFrom(
      this.teamsApi.teamsControllerCreate({
        workspaceId,
        createTeamDto,
      }),
    );
  }

  getSlackConnection(workspaceId: string): Promise<SlackConnectionView> {
    return firstValueFrom(
      this.http.get<SlackConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/slack`,
      ),
    );
  }

  startSlackOAuth(workspaceId: string): Promise<SlackOAuthStartView> {
    return firstValueFrom(
      this.http.get<SlackOAuthStartView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/slack/oauth/start`,
      ),
    );
  }

  disconnectSlack(workspaceId: string): Promise<SlackConnectionView> {
    return firstValueFrom(
      this.http.delete<SlackConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/slack`,
      ),
    );
  }

  listTeamSlackChannels(teamId: string): Promise<SlackChannelOptionView[]> {
    return firstValueFrom(
      this.http.get<{ channels: SlackChannelOptionView[] }>(
        `${this.apiBase}/teams/${teamId}/addons/slack/channels`,
      ),
    ).then((res) => res.channels);
  }

  getTeamSlackChannel(teamId: string): Promise<TeamSlackChannelView> {
    return firstValueFrom(
      this.http.get<TeamSlackChannelView>(
        `${this.apiBase}/teams/${teamId}/addons/slack/channel`,
      ),
    );
  }

  setTeamSlackChannel(
    teamId: string,
    body: SetTeamSlackChannelInput,
  ): Promise<TeamSlackChannelView> {
    return firstValueFrom(
      this.http.put<TeamSlackChannelView>(
        `${this.apiBase}/teams/${teamId}/addons/slack/channel`,
        body,
      ),
    );
  }

  clearTeamSlackChannel(teamId: string): Promise<TeamSlackChannelView> {
    return firstValueFrom(
      this.http.delete<TeamSlackChannelView>(
        `${this.apiBase}/teams/${teamId}/addons/slack/channel`,
      ),
    );
  }

  listTeamLinearProjects(teamId: string): Promise<LinearProjectView[]> {
    return firstValueFrom(
      this.http.get<LinearProjectView[]>(
        `${this.apiBase}/teams/${teamId}/addons/linear/projects`,
      ),
    );
  }

  getTeamLinearProject(teamId: string): Promise<TeamLinearProjectView> {
    return firstValueFrom(
      this.http.get<TeamLinearProjectView>(
        `${this.apiBase}/teams/${teamId}/addons/linear/project`,
      ),
    );
  }

  setTeamLinearProject(
    teamId: string,
    body: SetTeamLinearProjectInput,
  ): Promise<TeamLinearProjectView> {
    return firstValueFrom(
      this.http.put<TeamLinearProjectView>(
        `${this.apiBase}/teams/${teamId}/addons/linear/project`,
        body,
      ),
    );
  }

  clearTeamLinearProject(teamId: string): Promise<TeamLinearProjectView> {
    return firstValueFrom(
      this.http.delete<TeamLinearProjectView>(
        `${this.apiBase}/teams/${teamId}/addons/linear/project`,
      ),
    );
  }

  listTeamGithubRepos(teamId: string): Promise<GithubRepoView[]> {
    return firstValueFrom(
      this.http.get<GithubRepoView[]>(
        `${this.apiBase}/teams/${teamId}/addons/github/repos`,
      ),
    );
  }

  listTeamGithubIssues(
    teamId: string,
    owner: string,
    repo: string,
  ): Promise<GithubIssueView[]> {
    return firstValueFrom(
      this.http.get<GithubIssueView[]>(
        `${this.apiBase}/teams/${teamId}/addons/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      ),
    );
  }

  getTeamGithubTarget(teamId: string): Promise<TeamGithubTargetView> {
    return firstValueFrom(
      this.http.get<TeamGithubTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/github/target`,
      ),
    );
  }

  setTeamGithubTarget(
    teamId: string,
    body: SetTeamGithubTargetInput,
  ): Promise<TeamGithubTargetView> {
    return firstValueFrom(
      this.http.put<TeamGithubTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/github/target`,
        body,
      ),
    );
  }

  clearTeamGithubTarget(teamId: string): Promise<TeamGithubTargetView> {
    return firstValueFrom(
      this.http.delete<TeamGithubTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/github/target`,
      ),
    );
  }

  listTeamJiraProjects(teamId: string): Promise<JiraProjectView[]> {
    return firstValueFrom(
      this.http.get<JiraProjectView[]>(
        `${this.apiBase}/teams/${teamId}/addons/jira/projects`,
      ),
    );
  }

  listTeamJiraIssues(
    teamId: string,
    projectKey: string,
  ): Promise<JiraIssueView[]> {
    return firstValueFrom(
      this.http.get<JiraIssueView[]>(
        `${this.apiBase}/teams/${teamId}/addons/jira/projects/${encodeURIComponent(projectKey)}/issues`,
      ),
    );
  }

  getTeamJiraTarget(teamId: string): Promise<TeamJiraTargetView> {
    return firstValueFrom(
      this.http.get<TeamJiraTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/jira/target`,
      ),
    );
  }

  setTeamJiraTarget(
    teamId: string,
    body: SetTeamJiraTargetInput,
  ): Promise<TeamJiraTargetView> {
    return firstValueFrom(
      this.http.put<TeamJiraTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/jira/target`,
        body,
      ),
    );
  }

  clearTeamJiraTarget(teamId: string): Promise<TeamJiraTargetView> {
    return firstValueFrom(
      this.http.delete<TeamJiraTargetView>(
        `${this.apiBase}/teams/${teamId}/addons/jira/target`,
      ),
    );
  }

  getTeamsConnection(workspaceId: string): Promise<TeamsConnectionView> {
    return firstValueFrom(
      this.http.get<TeamsConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/teams`,
      ),
    );
  }

  connectTeams(
    workspaceId: string,
    body: ConnectTeamsInput,
  ): Promise<TeamsConnectionView> {
    return firstValueFrom(
      this.http.put<TeamsConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/teams`,
        body,
      ),
    );
  }

  disconnectTeams(workspaceId: string): Promise<TeamsConnectionView> {
    return firstValueFrom(
      this.http.delete<TeamsConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/teams`,
      ),
    );
  }

  getLinearConnection(workspaceId: string): Promise<LinearConnectionView> {
    return firstValueFrom(
      this.http.get<LinearConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/linear`,
      ),
    );
  }

  startLinearOAuth(workspaceId: string): Promise<LinearOAuthStartView> {
    return firstValueFrom(
      this.http.get<LinearOAuthStartView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/linear/oauth/start`,
      ),
    );
  }

  listLinearProjects(workspaceId: string): Promise<LinearProjectView[]> {
    return firstValueFrom(
      this.http.get<LinearProjectView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/linear/projects`,
      ),
    );
  }

  selectLinearProject(
    workspaceId: string,
    body: SelectLinearProjectInput,
  ): Promise<LinearConnectionView> {
    return firstValueFrom(
      this.http.put<LinearConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/linear/project`,
        body,
      ),
    );
  }

  disconnectLinear(workspaceId: string): Promise<LinearConnectionView> {
    return firstValueFrom(
      this.http.delete<LinearConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/linear`,
      ),
    );
  }

  getGithubConnection(workspaceId: string): Promise<GithubConnectionView> {
    return firstValueFrom(
      this.http.get<GithubConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github`,
      ),
    );
  }

  startGithubOAuth(workspaceId: string): Promise<GithubOAuthStartView> {
    return firstValueFrom(
      this.http.get<GithubOAuthStartView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github/oauth/start`,
      ),
    );
  }

  listGithubRepos(workspaceId: string): Promise<GithubRepoView[]> {
    return firstValueFrom(
      this.http.get<GithubRepoView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github/repos`,
      ),
    );
  }

  listGithubIssues(
    workspaceId: string,
    owner: string,
    repo: string,
  ): Promise<GithubIssueView[]> {
    return firstValueFrom(
      this.http.get<GithubIssueView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      ),
    );
  }

  selectGithubTarget(
    workspaceId: string,
    body: SelectGithubTargetInput,
  ): Promise<GithubConnectionView> {
    return firstValueFrom(
      this.http.put<GithubConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github/target`,
        body,
      ),
    );
  }

  disconnectGithub(workspaceId: string): Promise<GithubConnectionView> {
    return firstValueFrom(
      this.http.delete<GithubConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/github`,
      ),
    );
  }

  getJiraConnection(workspaceId: string): Promise<JiraConnectionView> {
    return firstValueFrom(
      this.http.get<JiraConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira`,
      ),
    );
  }

  startJiraOAuth(workspaceId: string): Promise<JiraOAuthStartView> {
    return firstValueFrom(
      this.http.get<JiraOAuthStartView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/oauth/start`,
      ),
    );
  }

  listJiraSites(workspaceId: string): Promise<JiraSiteView[]> {
    return firstValueFrom(
      this.http.get<JiraSiteView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/sites`,
      ),
    );
  }

  selectJiraSite(
    workspaceId: string,
    body: SelectJiraSiteInput,
  ): Promise<JiraConnectionView> {
    return firstValueFrom(
      this.http.put<JiraConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/site`,
        body,
      ),
    );
  }

  listJiraProjects(workspaceId: string): Promise<JiraProjectView[]> {
    return firstValueFrom(
      this.http.get<JiraProjectView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/projects`,
      ),
    );
  }

  listJiraIssues(
    workspaceId: string,
    projectKey: string,
  ): Promise<JiraIssueView[]> {
    return firstValueFrom(
      this.http.get<JiraIssueView[]>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/projects/${encodeURIComponent(projectKey)}/issues`,
      ),
    );
  }

  selectJiraTarget(
    workspaceId: string,
    body: SelectJiraTargetInput,
  ): Promise<JiraConnectionView> {
    return firstValueFrom(
      this.http.put<JiraConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira/target`,
        body,
      ),
    );
  }

  disconnectJira(workspaceId: string): Promise<JiraConnectionView> {
    return firstValueFrom(
      this.http.delete<JiraConnectionView>(
        `${this.apiBase}/workspaces/${workspaceId}/addons/jira`,
      ),
    );
  }
}
