import {
  AddonConnectionStatus,
  AddonProvider,
  TeamRole,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { LinearService } from './linear.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('LinearService', () => {
  it('reports a ready Linear add-on', () => {
    const service = new LinearService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'linear', status: 'ready' });
  });

  it('skips digest when Linear tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LinearService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'lin_oauth_token',
            metadataJson: { projectId: 'proj1' },
            provider: AddonProvider.LINEAR,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    await expect(
      service.postStandupDigest({
        workspaceId: 'ws1',
        teamName: 'Alpha',
        entryDate: '2026-10-26',
        content: 'hi',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a project update when tool and project are ready', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { projectUpdateCreate: { success: true } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const prisma = {
      isEnabled: () => true,
      workspaceTool: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      addonConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conn1',
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: 'lin_oauth_token',
          metadataJson: {
            projectId: 'proj1',
            projectName: 'Standups',
            accessExpiresAt: Date.now() + 60 * 60 * 1000,
          },
          provider: AddonProvider.LINEAR,
        }),
      },
    };

    const service = new LinearService(
      prisma as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    const ok = await service.postStandupDigest({
      workspaceId: 'ws1',
      teamId: 'team1abcd',
      teamName: 'Alpha',
      entryDate: '2026-10-26',
      content: '### Member\n- Today: shipped',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'lin_oauth_token',
        }),
      }),
    );
  });

  it('returns oauthAvailable false when env is missing', async () => {
    delete process.env['LINEAR_CLIENT_ID'];
    delete process.env['LINEAR_CLIENT_SECRET'];

    const service = new LinearService(
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

  it('uses team project override when posting digests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { projectUpdateCreate: { success: true } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LinearService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'lin_oauth_token',
            metadataJson: {
              projectId: 'workspace-proj',
              teamTargets: {
                team1abcd: {
                  projectId: 'team-proj',
                  projectName: 'Team proj',
                },
              },
              accessExpiresAt: Date.now() + 60 * 60 * 1000,
            },
            provider: AddonProvider.LINEAR,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    await expect(
      service.postStandupDigest({
        workspaceId: 'ws1',
        teamId: 'team1abcd',
        teamName: 'Alpha',
        entryDate: '2026-10-26',
        content: 'hi',
      }),
    ).resolves.toBe(true);

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    ) as {
      variables: { input: { projectId: string } };
    };
    expect(body.variables.input.projectId).toBe('team-proj');
  });

  it('sets and clears a team Linear project override', async () => {
    const update = jest.fn().mockResolvedValue({});
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        // getTeamProject after set — connection with override
        id: 'conn1',
        status: AddonConnectionStatus.CONNECTED,
        secretsRef: 'lin_oauth_token',
        metadataJson: {
          projectId: 'workspace-proj',
          projectName: 'Workspace',
          teamTargets: {
            team1abcd: { projectId: 'team-proj', projectName: 'Team proj' },
          },
          accessExpiresAt: Date.now() + 60 * 60 * 1000,
        },
        provider: AddonProvider.LINEAR,
      })
      .mockResolvedValue({
        id: 'conn1',
        status: AddonConnectionStatus.CONNECTED,
        secretsRef: 'lin_oauth_token',
        metadataJson: {
          projectId: 'workspace-proj',
          projectName: 'Workspace',
          accessExpiresAt: Date.now() + 60 * 60 * 1000,
        },
        provider: AddonProvider.LINEAR,
      });

    // Sequence for setTeamProject: requireFreshAccessToken connection,
    // then find connection to write, then getTeamProject.
    const connectionFind = jest.fn();
    let findCalls = 0;
    connectionFind.mockImplementation(() => {
      findCalls += 1;
      if (findCalls <= 2) {
        return Promise.resolve({
          id: 'conn1',
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: 'lin_oauth_token',
          metadataJson: {
            projectId: 'workspace-proj',
            projectName: 'Workspace',
            accessExpiresAt: Date.now() + 60 * 60 * 1000,
          },
          provider: AddonProvider.LINEAR,
        });
      }
      return findUnique();
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { project: { id: 'team-proj', name: 'Team proj' } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new LinearService(
      {
        isEnabled: () => true,
        teamMember: {
          findUnique: jest.fn().mockResolvedValue({
            role: TeamRole.ADMIN,
            team: { workspaceId: 'ws1' },
          }),
        },
        addonConnection: {
          findUnique: connectionFind,
          update,
        },
      } as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
      } as unknown as UsersService,
    );

    const setResult = await service.setTeamProject('team1abcd', admin, {
      projectId: 'team-proj',
    });
    expect(setResult.isOverride).toBe(true);
    expect(setResult.projectId).toBe('team-proj');
    expect(update).toHaveBeenCalled();
    const written = update.mock.calls[0][0].data.metadataJson as {
      teamTargets?: Record<string, { projectId: string }>;
    };
    expect(written.teamTargets?.['team1abcd']?.projectId).toBe('team-proj');

    // Reset for clear: connection with override, then get after clear.
    findCalls = 0;
    connectionFind.mockImplementation(() => {
      findCalls += 1;
      if (findCalls === 1) {
        return Promise.resolve({
          id: 'conn1',
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: 'lin_oauth_token',
          metadataJson: {
            projectId: 'workspace-proj',
            projectName: 'Workspace',
            teamTargets: {
              team1abcd: { projectId: 'team-proj', projectName: 'Team proj' },
            },
          },
          provider: AddonProvider.LINEAR,
        });
      }
      return Promise.resolve({
        id: 'conn1',
        status: AddonConnectionStatus.CONNECTED,
        secretsRef: 'lin_oauth_token',
        metadataJson: {
          projectId: 'workspace-proj',
          projectName: 'Workspace',
        },
        provider: AddonProvider.LINEAR,
      });
    });

    const cleared = await service.clearTeamProject('team1abcd', admin);
    expect(cleared.isOverride).toBe(false);
    expect(cleared.projectId).toBe('workspace-proj');
    const clearedMeta = update.mock.calls[1][0].data.metadataJson as {
      teamTargets?: Record<string, unknown>;
    };
    expect(clearedMeta.teamTargets).toBeUndefined();
  });
});
