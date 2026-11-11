import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { TrelloService } from './trello.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('TrelloService', () => {
  const users = {
    upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user1' }),
  } as unknown as UsersService;

  beforeEach(() => {
    delete process.env['TRELLO_CLIENT_ID'];
    delete process.env['TRELLO_CLIENT_SECRET'];
  });

  it('reports a ready Trello add-on', () => {
    const service = new TrelloService(
      { isEnabled: () => true } as unknown as PrismaService,
      users,
    );
    expect(service.status()).toEqual({ name: 'trello', status: 'ready' });
  });

  it('returns oauthAvailable false when env is missing', async () => {
    const service = new TrelloService(
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

  it('starts OAuth with a read scope and PKCE challenge', async () => {
    process.env['TRELLO_CLIENT_ID'] = 'tr-app';
    process.env['TRELLO_CLIENT_SECRET'] = 'secret';
    const upsert = jest.fn().mockResolvedValue({});
    const service = new TrelloService(
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
    expect(url.origin).toBe('https://auth.atlassian.com');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('client_id')).toBe('tr-app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(
      'read:member:trello read:board:trello offline_access',
    );
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/addons/trello/oauth/callback',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const challenge = url.searchParams.get('code_challenge');
    const stored = upsert.mock.calls[0]?.[0] as {
      create: { metadataJson: { codeVerifier: string } };
    };
    const expected = createHash('sha256')
      .update(stored.create.metadataJson.codeVerifier)
      .digest('base64url');
    expect(challenge).toBe(expected);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: AddonProvider.TRELLO,
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
        secretsRef: '{"accessToken":"tr"}',
        metadataJson: { accountLogin: 'ada' },
      })
      .mockResolvedValueOnce(null);
    const service = new TrelloService(
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

  it('searches open cards and drops closed ones', async () => {
    const fetchMock = jest.fn(async (input: string | URL) => {
      const path = String(input);
      if (path.includes('/search?')) {
        return {
          ok: true,
          json: async () => ({
            cards: [
              {
                name: 'Ship mentions',
                shortLink: 'abc123',
                closed: false,
                url: 'https://trello.com/c/abc123/1-ship-mentions',
              },
              {
                name: 'Done',
                shortLink: 'done1',
                closed: true,
                url: 'https://trello.com/c/done1/2-done',
              },
            ],
          }),
        };
      }
      throw new Error(path);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new TrelloService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conn1',
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: JSON.stringify({ accessToken: 'tr' }),
          }),
        },
      } as unknown as PrismaService,
      users,
    );
    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual([
      {
        provider: 'trello',
        key: 'abc123',
        title: 'Ship mentions',
        url: 'https://trello.com/c/abc123/1-ship-mentions',
      },
    ]);
  });

  it('returns no mentions when the tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new TrelloService(
      {
        isEnabled: () => true,
        workspaceTool: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      users,
    );
    await expect(service.searchMentionIssues('ws1', 'ship')).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
