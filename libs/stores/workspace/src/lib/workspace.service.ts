import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AuthDataService,
  MeWorkspaceDtoRoleEnum,
  TeamsDataService,
  WorkspacesDataService,
  type CreateTeamDto,
  type CreateWorkspaceDto,
  type MeWorkspaceDto,
  type TeamDto,
  type WorkspaceDto,
  type WorkspaceToolDto,
} from '@silvervibe/shared/api-client';
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
  LinearConnectionView,
  LinearOAuthStartView,
  LinearProjectView,
  SelectGithubTargetInput,
  SelectLinearProjectInput,
  SlackConnectionView,
  SlackOAuthStartView,
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

function mapMembership(dto: MeWorkspaceDto): WorkspaceMembershipView {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
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
}
