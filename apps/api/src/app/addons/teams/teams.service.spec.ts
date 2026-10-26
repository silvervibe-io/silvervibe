import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { TeamsService } from './teams.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

const sampleWebhook =
  'https://company.webhook.office.com/webhookb2/abc/IncomingWebhook/xyz/123';

describe('TeamsService', () => {
  const envKeys = [
    'TEAMS_CLIENT_ID',
    'TEAMS_CLIENT_SECRET',
    'TEAMS_TENANT_ID',
    'PUBLIC_API_URL',
    'PUBLIC_STANDUP_URL',
  ] as const;
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of envKeys) {
      previous.set(key, process.env[key]);
    }
    process.env['TEAMS_CLIENT_ID'] = 'tid';
    process.env['TEAMS_CLIENT_SECRET'] = 'tsecret';
    process.env['TEAMS_TENANT_ID'] = 'organizations';
    process.env['PUBLIC_API_URL'] = 'http://localhost:3000/api';
    process.env['PUBLIC_STANDUP_URL'] = 'http://localhost:4201';
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('reports a ready Microsoft Teams add-on', () => {
    const service = new TeamsService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'teams', status: 'ready' });
  });

  it('starts OAuth and returns an authorize URL', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
      },
      addonConnection: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const service = new TeamsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const result = await service.startOAuth('ws1', admin);
    expect(prisma.addonConnection.upsert).toHaveBeenCalled();
    expect(result.authorizeUrl).toContain(
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?',
    );
    expect(result.authorizeUrl).toContain('client_id=tid');
    expect(result.authorizeUrl).toContain('ChannelMessage.Send');
    expect(result.authorizeUrl).toContain('state=');
  });

  it('rejects webhook URLs that only mention office hosts in the path', async () => {
    const service = new TeamsService(
      {
        isEnabled: () => true,
        workspaceMember: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ role: WorkspaceRole.ADMIN }),
        },
      } as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    await expect(
      service.connect('ws1', admin, {
        incomingWebhookUrl: 'https://evil.example/webhook.office.com/hook',
      }),
    ).rejects.toThrow(/Incoming Webhook/);
  });

  it('connects a legacy Incoming Webhook and enables addons.teams', async () => {
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
      addonConnection: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: sampleWebhook,
          metadataJson: { channelLabel: 'Standups', authMode: 'webhook' },
        }),
      },
      workspaceTool: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          toolKey: 'addons.teams',
          enabled: true,
        }),
      },
    };

    const service = new TeamsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const result = await service.connect('ws1', admin, {
      incomingWebhookUrl: sampleWebhook,
      channelLabel: 'Standups',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      status: 'CONNECTED',
      configured: true,
      authMode: 'webhook',
      channelLabel: 'Standups',
      needsChannel: false,
      toolEnabled: true,
      oauthAvailable: true,
    });
  });

  it('posts a digest via Graph for OAuth installs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const tokens = JSON.stringify({
      accessToken: 'atok',
      refreshToken: 'rtok',
      expiresAt: Date.now() + 3_600_000,
    });

    const prisma = {
      isEnabled: () => true,
      workspaceTool: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      addonConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conn1',
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: tokens,
          metadataJson: {
            authMode: 'oauth',
            teamId: 'team-1',
            channelId: 'chan-1',
            channelLabel: 'Standups',
          },
          provider: AddonProvider.TEAMS,
        }),
        update: jest.fn(),
      },
    };

    const service = new TeamsService(
      prisma as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    const ok = await service.postStandupDigest({
      workspaceId: 'ws1',
      teamName: 'Alpha',
      entryDate: '2026-10-20',
      content: '### Member\n- Today: shipped',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/teams/team-1/channels/chan-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer atok',
        }),
      }),
    );
  });

  it('posts a digest via Incoming Webhook for legacy installs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '1',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const prisma = {
      isEnabled: () => true,
      workspaceTool: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      addonConnection: {
        findUnique: jest.fn().mockResolvedValue({
          status: AddonConnectionStatus.CONNECTED,
          secretsRef: sampleWebhook,
          metadataJson: { channelLabel: 'Standups', authMode: 'webhook' },
          provider: AddonProvider.TEAMS,
        }),
      },
    };

    const service = new TeamsService(
      prisma as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    const ok = await service.postStandupDigest({
      workspaceId: 'ws1',
      teamName: 'Alpha',
      entryDate: '2026-10-20',
      content: '### Member\n- Today: shipped',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      sampleWebhook,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Alpha'),
      }),
    );
  });

  it('skips digest when Teams tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new TeamsService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: sampleWebhook,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as UsersService,
    );

    await expect(
      service.postStandupDigest({
        workspaceId: 'ws1',
        teamName: 'Alpha',
        entryDate: '2026-10-20',
        content: 'hi',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('completes OAuth callback and redirects to channel picker', async () => {
    let pendingMeta: Record<string, unknown> = {};
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
      },
      addonConnection: {
        upsert: jest
          .fn()
          .mockImplementation(
            async (args: {
              create: { metadataJson: Record<string, unknown> };
              update: { metadataJson: Record<string, unknown> };
            }) => {
              pendingMeta =
                args.create?.metadataJson ?? args.update?.metadataJson ?? {};
              return {};
            },
          ),
        findUnique: jest.fn().mockImplementation(async () => ({
          status: AddonConnectionStatus.PENDING,
          metadataJson: pendingMeta,
        })),
      },
    };

    const service = new TeamsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const { authorizeUrl } = await service.startOAuth('ws1', admin);
    const state = new URL(authorizeUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'atok',
        refresh_token: 'rtok',
        expires_in: 3600,
      }),
    }) as unknown as typeof fetch;

    const url = await service.completeOAuthCallback(
      'code-1',
      state ?? undefined,
      undefined,
    );

    expect(url).toContain('/app/workspace');
    expect(url).toContain('teams=pick');
  });
});
