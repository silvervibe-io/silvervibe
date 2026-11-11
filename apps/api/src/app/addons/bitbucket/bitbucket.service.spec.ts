import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { BitbucketService } from './bitbucket.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('BitbucketService', () => {
  const users = {
    upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
  } as unknown as UsersService;

  beforeEach(() => {
    delete process.env['BITBUCKET_CLIENT_ID'];
    delete process.env['BITBUCKET_CLIENT_SECRET'];
  });

  it('reports a ready Bitbucket add-on', () => {
    const service = new BitbucketService(
      { isEnabled: () => true } as unknown as PrismaService,
      users,
    );
    expect(service.status()).toEqual({ name: 'bitbucket', status: 'ready' });
  });

  it('returns oauthAvailable false when env is missing', async () => {
    const service = new BitbucketService(
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
  });

  it('starts OAuth against Bitbucket Cloud and stores a pending install', async () => {
    process.env['BITBUCKET_CLIENT_ID'] = 'bb-app';
    process.env['BITBUCKET_CLIENT_SECRET'] = 'secret';
    const upsert = jest.fn().mockResolvedValue({});
    const service = new BitbucketService(
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
    expect(url.origin).toBe('https://bitbucket.org');
    expect(url.pathname).toBe('/site/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('bb-app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/addons/bitbucket/oauth/callback',
    );
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('scope')).toBeNull();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: AddonProvider.BITBUCKET,
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
        secretsRef: '{"accessToken":"bb"}',
        metadataJson: { accountLogin: 'ada' },
      })
      .mockResolvedValueOnce(null);
    const service = new BitbucketService(
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

  it('searches issues the account can access and drops resolved ones', async () => {
    const fetchMock = jest.fn(async (input: string | URL) => {
      const path = String(input);
      if (path.includes('/user/workspaces')) {
        return {
          ok: true,
          json: async () => ({
            values: [{ workspace: { slug: 'acme' } }],
          }),
        };
      }
      if (path.includes('/repositories/acme?')) {
        return {
          ok: true,
          json: async () => ({
            values: [{ full_name: 'acme/app', has_issues: true }],
          }),
        };
      }
      if (path.includes('/issues')) {
        return {
          ok: true,
          json: async () => ({
            values: [
              {
                id: 7,
                title: 'Ship mentions',
                state: 'open',
                links: {
                  html: {
                    href: 'https://bitbucket.org/acme/app/issues/7',
                  },
                },
              },
              {
                id: 8,
                title: 'Done',
                state: 'resolved',
                links: {
                  html: {
                    href: 'https://bitbucket.org/acme/app/issues/8',
                  },
                },
              },
            ],
          }),
        };
      }
      throw new Error(path);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new BitbucketService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: JSON.stringify({ accessToken: 'bb' }),
          }),
        },
      } as unknown as PrismaService,
      users,
    );

    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual([
      {
        provider: 'bitbucket',
        key: 'acme/app#7',
        title: 'Ship mentions',
        url: 'https://bitbucket.org/acme/app/issues/7',
      },
    ]);
    const issueCall = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes('/issues'));
    expect(issueCall).toContain('title');
    expect(decodeURIComponent(issueCall ?? '')).toContain('ship');
  });

  it('returns no mentions when the tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new BitbucketService(
      {
        isEnabled: () => true,
        workspaceTool: { findUnique: jest.fn().mockResolvedValue(null) },
        addonConnection: { findUnique: jest.fn() },
      } as unknown as PrismaService,
      users,
    );
    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
