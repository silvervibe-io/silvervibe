import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { GithubService } from './github.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('GithubService', () => {
  it('reports a ready GitHub add-on', () => {
    const service = new GithubService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'github', status: 'ready' });
  });

  it('skips digest when GitHub tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new GithubService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'gho_token',
            metadataJson: {
              owner: 'org',
              repo: 'repo',
              issueNumber: 1,
            },
            provider: AddonProvider.GITHUB,
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

  it('posts an issue comment when tool and target are ready', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new GithubService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'gho_token',
            metadataJson: {
              owner: 'silvervibe-io',
              repo: 'silvervibe',
              issueNumber: 42,
              issueTitle: 'Standups',
            },
            provider: AddonProvider.GITHUB,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    const ok = await service.postStandupDigest({
      workspaceId: 'ws1',
      teamName: 'Alpha',
      entryDate: '2026-10-26',
      content: '### Member\n- Today: shipped',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/silvervibe-io/silvervibe/issues/42/comments',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('returns oauthAvailable false when env is missing', async () => {
    delete process.env['GITHUB_CLIENT_ID'];
    delete process.env['GITHUB_CLIENT_SECRET'];

    const service = new GithubService(
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
