import {
  AddonConnectionStatus,
  AddonProvider,
  TeamRole,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { JiraService } from './jira.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('JiraService', () => {
  it('reports a ready Jira add-on', () => {
    const service = new JiraService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'jira', status: 'ready' });
  });

  it('skips digest when Jira tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new JiraService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'atlassian_token',
            metadataJson: { cloudId: 'cloud1', issueKey: 'ENG-1' },
            provider: AddonProvider.JIRA,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    await expect(
      service.postStandupDigest({
        workspaceId: 'ws1',
        teamName: 'Alpha',
        entryDate: '2026-10-27',
        content: 'hi',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a comment when tool and target are ready', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1' }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new JiraService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'atlassian_token',
            metadataJson: {
              cloudId: 'cloud1',
              issueKey: 'ENG-42',
              accessExpiresAt: Date.now() + 60 * 60 * 1000,
            },
            provider: AddonProvider.JIRA,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    const ok = await service.postStandupDigest({
      workspaceId: 'ws1',
      teamName: 'Alpha',
      entryDate: '2026-10-27',
      content: '### Member\n- Today: shipped',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.atlassian.com/ex/jira/cloud1/rest/api/3/issue/ENG-42/comment',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lists team projects against an explicit cloudId override', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [{ id: '1', key: 'ENG', name: 'Engineering' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new JiraService(
      {
        isEnabled: () => true,
        teamMember: {
          findUnique: jest.fn().mockResolvedValue({
            role: TeamRole.ADMIN,
            team: { workspaceId: 'ws1' },
          }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'atlassian_token',
            metadataJson: {
              cloudId: 'workspace-cloud',
              accessExpiresAt: Date.now() + 60 * 60 * 1000,
            },
            provider: AddonProvider.JIRA,
          }),
        },
      } as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
      } as unknown as UsersService,
    );

    const projects = await service.listProjectsForTeam(
      'team1abcd',
      admin,
      'other-cloud-id',
    );
    expect(projects).toEqual([{ id: '1', key: 'ENG', name: 'Engineering' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.atlassian.com/ex/jira/other-cloud-id/rest/api/3/project/search?maxResults=50',
      expect.any(Object),
    );
  });

  it('returns oauthAvailable false when env is missing', async () => {
    delete process.env['JIRA_CLIENT_ID'];
    delete process.env['JIRA_CLIENT_SECRET'];

    const service = new JiraService(
      {
        isEnabled: () => true,
        workspaceMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ role: WorkspaceRole.ADMIN }),
        },
        addonConnection: { findUnique: jest.fn().mockResolvedValue(null) },
        workspaceTool: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
      } as unknown as UsersService,
    );

    const conn = await service.getConnection('ws1', admin);
    expect(conn.oauthAvailable).toBe(false);
    expect(conn.configured).toBe(false);
  });
});
