import { describe, expect, it } from 'vitest';
import {
  resolveStandupHome,
  standupAccess,
  standupHomeUrl,
  standupShellLinks,
} from './standup-nav';

describe('resolveStandupHome', () => {
  it('sends workspace owners and admins to workspace admin', () => {
    expect(
      resolveStandupHome({ workspaceRole: 'OWNER', teamRoles: ['MEMBER'] }),
    ).toBe('/app/workspace');
    expect(resolveStandupHome({ workspaceRole: 'ADMIN', teamRoles: [] })).toBe(
      '/app/workspace',
    );
  });

  it('sends team admins to team admin', () => {
    expect(
      resolveStandupHome({
        workspaceRole: 'MEMBER',
        teamRoles: ['MEMBER', 'ADMIN'],
      }),
    ).toBe('/app/team');
  });

  it('sends members to my standup', () => {
    expect(
      resolveStandupHome({ workspaceRole: 'MEMBER', teamRoles: ['MEMBER'] }),
    ).toBe('/app');
    expect(resolveStandupHome({ workspaceRole: null, teamRoles: [] })).toBe(
      '/app',
    );
  });
});

describe('standupAccess', () => {
  it('hides admin links for a member', () => {
    expect(
      standupAccess({ workspaceRole: 'MEMBER', teamRoles: ['MEMBER'] }),
    ).toEqual({ showTeamAdmin: false, showWorkspace: false });
  });

  it('shows team admin without workspace admin', () => {
    expect(
      standupAccess({ workspaceRole: 'MEMBER', teamRoles: ['ADMIN'] }),
    ).toEqual({ showTeamAdmin: true, showWorkspace: false });
  });

  it('shows both admin links for a workspace admin', () => {
    expect(standupAccess({ workspaceRole: 'OWNER', teamRoles: [] })).toEqual({
      showTeamAdmin: true,
      showWorkspace: true,
    });
  });
});

describe('standupHomeUrl', () => {
  it('keeps the workspace id on the destination', () => {
    expect(standupHomeUrl('/app/team', 'ws 1')).toBe(
      '/app/team?workspaceId=ws%201',
    );
  });
});

describe('standupShellLinks', () => {
  it('returns only the links the role can use', () => {
    const links = standupShellLinks(
      { workspaceRole: 'MEMBER', teamRoles: ['ADMIN'] },
      (key) => key,
    );
    expect(links.map((link) => link.href)).toEqual([
      '/app',
      '/app/team',
      '/app/settings',
      '/account',
    ]);
  });
});
