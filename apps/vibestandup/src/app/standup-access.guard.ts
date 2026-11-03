import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  resolveStandupHome,
  standupAccess,
  standupHomeUrl,
  StandupFacade,
  type StandupAccessInput,
} from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

function accessInput(
  workspaces: WorkspaceFacade,
  standup: StandupFacade,
  preview: PreviewContextStore,
): StandupAccessInput {
  return {
    workspaceRole: workspaces.effectiveWorkspaceRole(),
    teamRoles: preview.isActive()
      ? [preview.teamRole()]
      : standup.teams().map((team) => team.role),
  };
}

/** Blocks team and workspace admin routes the signed-in role cannot use. */
export const standupAreaGuard: CanActivateFn = async (route, state) => {
  void state;
  const area = route.data['standupArea'] === 'workspace' ? 'workspace' : 'team';
  const workspaces = inject(WorkspaceFacade);
  const standup = inject(StandupFacade);
  const preview = inject(PreviewContextStore);
  const router = inject(Router);
  const workspaceId = route.queryParamMap.get('workspaceId');

  await workspaces.loadMyWorkspaces(workspaceId);
  const workspace = workspaces.selectedWorkspace();
  if (!workspace) {
    return router.parseUrl('/app');
  }

  await standup.loadMyTeams(workspace.id);
  const input = accessInput(workspaces, standup, preview);
  const access = standupAccess(input);
  const allowed =
    area === 'workspace' ? access.showWorkspace : access.showTeamAdmin;
  if (allowed) {
    return true;
  }
  return router.parseUrl(
    standupHomeUrl(resolveStandupHome(input), workspace.id),
  );
};
