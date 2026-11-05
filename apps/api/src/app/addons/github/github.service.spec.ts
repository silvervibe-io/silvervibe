import {
  AddonConnectionStatus,
  AddonProvider,
  TeamRole,
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

  it('posts a digest comment on the standing repository issue', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          number: 42,
          title: 'VibeStandup digests',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
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
              digestIssueNumber: 42,
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

  it('saves a team repository override without an issue number', async () => {
    const connection: {
      id: string;
      status: AddonConnectionStatus;
      secretsRef: string;
      metadataJson: Record<string, unknown>;
      provider: AddonProvider;
    } = {
      id: 'conn1',
      status: AddonConnectionStatus.CONNECTED,
      secretsRef: 'gho_token',
      metadataJson: {
        accountLogin: 'silvervibe-io',
        owner: 'silvervibe-io',
        repo: 'silvervibe',
        issueNumber: 136,
      },
      provider: AddonProvider.GITHUB,
    };
    const update = jest.fn(
      async (args: { data: { metadataJson: Record<string, unknown> } }) => {
        connection.metadataJson = args.data.metadataJson;
        return connection;
      },
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ full_name: 'silvervibe-io/silvervibe' }),
      text: async () => '',
    }) as unknown as typeof fetch;

    const service = new GithubService(
      {
        isEnabled: () => true,
        teamMember: {
          findUnique: jest.fn().mockResolvedValue({
            role: TeamRole.ADMIN,
            team: { workspaceId: 'ws1' },
          }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue(connection),
          update,
        },
      } as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
      } as unknown as UsersService,
    );

    const view = await service.setTeamTarget(
      'cmvf4nf6w0003wua8crksyvwz',
      admin,
      { owner: 'silvervibe-io', repo: 'silvervibe' },
    );

    expect(view.isOverride).toBe(true);
    expect(view.owner).toBe('silvervibe-io');
    expect(view.repo).toBe('silvervibe');
    expect(view.issueNumber).toBeNull();
    const saved = update.mock.calls[0]?.[0].data.metadataJson as {
      issueNumber?: number;
      issueTitle?: string;
      teamTargets: Record<string, { owner: string; repo: string }>;
    };
    expect(saved.teamTargets['cmvf4nf6w0003wua8crksyvwz']).toEqual({
      owner: 'silvervibe-io',
      repo: 'silvervibe',
    });
    expect(saved.issueNumber).toBe(136);
    expect(saved).not.toHaveProperty('issueTitle');
    expect(JSON.stringify(saved)).not.toContain('undefined');
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

  it('searches issues with is:issue and drops a failed call', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            number: 7,
            title: 'Ship mentions',
            html_url: 'https://github.com/acme/app/issues/7',
            repository_url: 'https://api.github.com/repos/acme/app',
          },
        ],
      }),
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
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'gho_token',
            provider: AddonProvider.GITHUB,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    await expect(
      service.searchMentionIssues('ws1', 'say "hi"'),
    ).resolves.toEqual([
      {
        provider: 'github',
        key: 'acme/app#7',
        title: 'Ship mentions',
        url: 'https://github.com/acme/app/issues/7',
      },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      encodeURIComponent('say "hi" is:issue'),
    );

    fetchMock.mockRejectedValueOnce(new Error('bad credentials'));
    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual(
      [],
    );
  });
});
