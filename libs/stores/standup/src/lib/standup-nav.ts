import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';

export type StandupHomePath = '/app' | '/app/team' | '/app/workspace';

export type StandupTeamRole = 'ADMIN' | 'MEMBER';

export type StandupAccessInput = {
  workspaceRole: PreviewWorkspaceRole | null;
  teamRoles: ReadonlyArray<StandupTeamRole>;
};

export type StandupAccess = {
  showTeamAdmin: boolean;
  showWorkspace: boolean;
};

export function standupAccess(input: StandupAccessInput): StandupAccess {
  const showWorkspace =
    input.workspaceRole === 'OWNER' || input.workspaceRole === 'ADMIN';
  const showTeamAdmin =
    showWorkspace || input.teamRoles.some((role) => role === 'ADMIN');
  return { showTeamAdmin, showWorkspace };
}

/** Highest privilege the user can act on: workspace, then team, then member. */
export function resolveStandupHome(input: StandupAccessInput): StandupHomePath {
  if (input.workspaceRole === 'OWNER' || input.workspaceRole === 'ADMIN') {
    return '/app/workspace';
  }
  if (input.teamRoles.some((role) => role === 'ADMIN')) {
    return '/app/team';
  }
  return '/app';
}

export function standupHomeUrl(
  home: StandupHomePath,
  workspaceId?: string | null,
): string {
  const id = workspaceId?.trim();
  if (!id) {
    return home;
  }
  return `${home}?workspaceId=${encodeURIComponent(id)}`;
}

const NAV = {
  myStandup: { key: 'standup.nav.myStandup', href: '/app' },
  settings: { key: 'standup.nav.settings', href: '/app/settings' },
  teamAdmin: { key: 'standup.nav.teamAdmin', href: '/app/team' },
  workspace: { key: 'standup.nav.workspace', href: '/app/workspace' },
  account: { key: 'nav.account', href: '/account' },
} as const;

export function standupShellLinks(
  input: StandupAccessInput,
  translate: (key: string) => string,
): Array<{ label: string; href: string }> {
  const access = standupAccess(input);
  const links: Array<{ key: string; href: string }> = [NAV.myStandup];
  if (access.showTeamAdmin) {
    links.push(NAV.teamAdmin);
  }
  if (access.showWorkspace) {
    links.push(NAV.workspace);
  }
  links.push(NAV.settings, NAV.account);
  return links.map((link) => ({
    label: translate(link.key),
    href: link.href,
  }));
}
