import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { GitlabService } from './gitlab.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('GitlabService', () => {
  const users = {
    upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
  } as unknown as UsersService;

  beforeEach(() => {
    delete process.env['GITLAB_CLIENT_ID'];
    delete process.env['GITLAB_CLIENT_SECRET'];
    delete process.env['GITLAB_BASE_URL'];
  });

  it('reports a ready GitLab add-on', () => {
    const service = new GitlabService(
      { isEnabled: () => true } as unknown as PrismaService,
      users,
    );
    expect(service.status()).toEqual({ name: 'gitlab', status: 'ready' });
  });

  it('returns oauthAvailable false when env is missing', async () => {
    const service = new GitlabService(
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
      users,
    );

    const conn = await service.getConnection('ws1', admin);
    expect(conn.oauthAvailable).toBe(false);
    expect(conn.configured).toBe(false);
    expect(conn.status).toBe('DISCONNECTED');
  });

  it('starts OAuth with read scopes and marks the connection pending', async () => {
    process.env['GITLAB_CLIENT_ID'] = 'gl-app';
    process.env['GITLAB_CLIENT_SECRET'] = 'gl-secret';
    const upsert = jest.fn().mockResolvedValue({});
    const service = new GitlabService(
      {
        isEnabled: () => true,
        workspaceMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ role: WorkspaceRole.OWNER }),
        },
        addonConnection: { upsert },
      } as unknown as PrismaService,
      users,
    );

    const { authorizeUrl } = await service.startOAuth('ws1', admin);
    const url = new URL(authorizeUrl);
    expect(url.origin).toBe('https://gitlab.com');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('gl-app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('read_api read_user');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: AddonProvider.GITLAB,
          status: AddonConnectionStatus.PENDING,
        }),
        update: expect.objectContaining({
          status: AddonConnectionStatus.PENDING,
        }),
      }),
    );
  });

  it('clears the stored token on disconnect', async () => {
    const update = jest.fn().mockResolvedValue({});
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'conn1',
        status: AddonConnectionStatus.CONNECTED,
        secretsRef: '{"accessToken":"glpat"}',
        metadataJson: { accountLogin: 'ada' },
      })
      .mockResolvedValueOnce(null);
    const service = new GitlabService(
      {
        isEnabled: () => true,
        workspaceMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ role: WorkspaceRole.ADMIN }),
        },
        addonConnection: { findUnique, update },
        workspaceTool: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      users,
    );

    const conn = await service.disconnect('ws1', admin);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AddonConnectionStatus.DISCONNECTED,
          secretsRef: null,
        }),
      }),
    );
    expect(conn.configured).toBe(false);
  });

  it('searches issues the account can access and drops closed ones', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          iid: 12,
          title: 'Ship mentions',
          state: 'opened',
          web_url: 'https://gitlab.com/acme/app/-/issues/12',
          references: { full: 'acme/app#12' },
        },
        {
          iid: 13,
          title: 'Done',
          state: 'closed',
          web_url: 'https://gitlab.com/acme/app/-/issues/13',
        },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = connectedService();

    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual([
      {
        provider: 'gitlab',
        key: 'acme/app#12',
        title: 'Ship mentions',
        url: 'https://gitlab.com/acme/app/-/issues/12',
      },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v4/search?scope=issues&search=ship',
    );
  });

  it('falls back to authored and assigned issues when search is rejected', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
        text: async () => 'scope=all disabled',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            iid: 4,
            title: 'Authored',
            state: 'opened',
            web_url: 'https://gitlab.com/acme/app/-/issues/4',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            iid: 4,
            title: 'Authored',
            state: 'opened',
            web_url: 'https://gitlab.com/acme/app/-/issues/4',
          },
          {
            iid: 9,
            title: 'Assigned',
            state: 'opened',
            web_url: 'https://gitlab.com/acme/web/-/work_items/9',
          },
        ],
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      connectedService().searchMentionIssues('ws1', 'ship'),
    ).resolves.toEqual([
      {
        provider: 'gitlab',
        key: 'acme/app#4',
        title: 'Authored',
        url: 'https://gitlab.com/acme/app/-/issues/4',
      },
      {
        provider: 'gitlab',
        key: 'acme/web#9',
        title: 'Assigned',
        url: 'https://gitlab.com/acme/web/-/work_items/9',
      },
    ]);
  });

  it('lists recent authored and assigned issues', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.includes('created_by_me')
          ? [
              {
                iid: 2,
                title: 'Mine',
                state: 'opened',
                web_url: 'https://gitlab.com/acme/app/-/issues/2',
              },
            ]
          : [],
      text: async () => '',
    })) as unknown as typeof fetch;

    await expect(
      connectedService().recentMentionIssues('ws1'),
    ).resolves.toEqual([
      {
        provider: 'gitlab',
        key: 'acme/app#2',
        title: 'Mine',
        url: 'https://gitlab.com/acme/app/-/issues/2',
      },
    ]);
  });

  it('returns nothing when the GitLab tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new GitlabService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: '{"accessToken":"glpat"}',
          }),
        },
      } as unknown as PrismaService,
      users,
    );

    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function connectedService(): GitlabService {
  return new GitlabService(
    {
      isEnabled: () => true,
      workspaceTool: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      addonConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conn1',
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: JSON.stringify({
            accessToken: 'glpat',
            expiresAt: Date.now() + 3_600_000,
          }),
        }),
      },
    } as unknown as PrismaService,
    {} as unknown as UsersService,
  );
}
