import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { SlackService } from './slack.service';

const admin: VerifiedUser = { uid: 'uid-admin', email: 'admin@example.com' };

describe('SlackService', () => {
  const envKeys = [
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'PUBLIC_API_URL',
    'PUBLIC_STANDUP_URL',
  ] as const;
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of envKeys) {
      previous.set(key, process.env[key]);
    }
    process.env['SLACK_CLIENT_ID'] = 'cid';
    process.env['SLACK_CLIENT_SECRET'] = 'csecret';
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

  it('reports a ready Slack add-on', () => {
    const service = new SlackService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'slack', status: 'ready' });
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

    const service = new SlackService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const result = await service.startOAuth('ws1', admin);

    expect(prisma.addonConnection.upsert).toHaveBeenCalled();
    expect(result.authorizeUrl).toContain(
      'https://slack.com/oauth/v2/authorize?',
    );
    expect(result.authorizeUrl).toContain('client_id=cid');
    expect(result.authorizeUrl).toContain('chat%3Awrite');
    expect(result.authorizeUrl).toContain('channels%3Ajoin');
    expect(result.authorizeUrl).toContain('state=');
  });

  it('connects a legacy Incoming Webhook and enables addons.slack', async () => {
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
          secretsRef: 'https://hooks.slack.com/services/T/B/x',
          metadataJson: { channelLabel: '#standups', authMode: 'webhook' },
        }),
      },
      workspaceTool: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          toolKey: 'addons.slack',
          enabled: true,
        }),
      },
    };

    const service = new SlackService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const result = await service.connect('ws1', admin, {
      incomingWebhookUrl: 'https://hooks.slack.com/services/T/B/x',
      channelLabel: '#standups',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      status: 'CONNECTED',
      configured: true,
      authMode: 'webhook',
      channelLabel: '#standups',
      toolEnabled: true,
      oauthAvailable: true,
    });
  });

  it('posts a digest via chat.postMessage for OAuth installs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
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
          secretsRef: 'xoxb-test-token',
          metadataJson: {
            authMode: 'oauth',
            channelId: 'C123',
            channelLabel: '#standups',
          },
          provider: AddonProvider.SLACK,
        }),
      },
    };

    const service = new SlackService(
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
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer xoxb-test-token',
        }),
        body: expect.stringContaining('C123'),
      }),
    );
  });

  it('posts a digest via Incoming Webhook for legacy installs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
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
          secretsRef: 'https://hooks.slack.com/services/T/B/x',
          metadataJson: { channelLabel: '#standups', authMode: 'webhook' },
          provider: AddonProvider.SLACK,
        }),
      },
    };

    const service = new SlackService(
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
      'https://hooks.slack.com/services/T/B/x',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Alpha'),
      }),
    );
  });

  it('skips digest when Slack tool is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new SlackService(
      {
        isEnabled: () => true,
        workspaceTool: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false }),
        },
        addonConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: AddonConnectionStatus.CONNECTED,
            secretsRef: 'xoxb-test',
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

  it('completes OAuth callback and redirects to connected', async () => {
    let pendingMeta: Record<string, unknown> = {};
    const prisma = {
      isEnabled: () => true,
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
      addonConnection: {
        upsert: jest
          .fn()
          .mockImplementation(
            async (args: {
              create: { metadataJson: Record<string, unknown> };
              update: { metadataJson: Record<string, unknown> };
            }) => {
              pendingMeta =
                args.create.metadataJson ?? args.update.metadataJson;
              return {};
            },
          ),
        findUnique: jest.fn().mockImplementation(async () => ({
          status: AddonConnectionStatus.PENDING,
          metadataJson: pendingMeta,
        })),
      },
      workspaceTool: { upsert: jest.fn() },
    };

    const service = new SlackService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
    );

    const { authorizeUrl } = await service.startOAuth('ws1', admin);
    const state = new URL(authorizeUrl).searchParams.get('state');
    expect(state).toBeTruthy();
    expect(pendingMeta['oauthNonce']).toBeTruthy();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        access_token: 'xoxb-new',
        team: { id: 'T1', name: 'Acme' },
        incoming_webhook: {
          channel: '#standups',
          channel_id: 'C99',
          url: 'https://hooks.slack.com/services/T/B/x',
        },
      }),
    }) as unknown as typeof fetch;

    const url = await service.completeOAuthCallback(
      'code-1',
      state ?? undefined,
      undefined,
    );

    expect(url).toContain('/app/workspace');
    expect(url).toContain('slack=connected');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
