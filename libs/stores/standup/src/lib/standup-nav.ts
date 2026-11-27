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

export type StandupShellLink = {
  label: string;
  href: string;
  external?: boolean;
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
  portalHref?: string,
): StandupShellLink[] {
  const access = standupAccess(input);
  const links: StandupShellLink[] = [];
  if (portalHref) {
    links.push({
      label: translate('nav.portal'),
      href: portalHref,
      external: true,
    });
  }
  links.push({
    label: translate(NAV.myStandup.key),
    href: NAV.myStandup.href,
  });
  if (access.showTeamAdmin) {
    links.push({
      label: translate(NAV.teamAdmin.key),
      href: NAV.teamAdmin.href,
    });
  }
  if (access.showWorkspace) {
    links.push({
      label: translate(NAV.workspace.key),
      href: NAV.workspace.href,
    });
  }
  links.push(
    { label: translate(NAV.settings.key), href: NAV.settings.href },
    { label: translate(NAV.account.key), href: NAV.account.href },
  );
  return links;
}
