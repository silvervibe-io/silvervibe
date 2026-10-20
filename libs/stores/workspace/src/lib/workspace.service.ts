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
import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';
import { firstValueFrom } from 'rxjs';
import type {
  CreateTeamInput,
  CreateWorkspaceInput,
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
}
