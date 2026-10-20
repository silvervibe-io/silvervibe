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
  it('reports a ready Slack add-on', () => {
    const service = new SlackService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'slack', status: 'ready' });
  });

  it('connects an Incoming Webhook and enables addons.slack', async () => {
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
          metadataJson: { channelLabel: '#standups' },
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
      channelLabel: '#standups',
      toolEnabled: true,
    });
  });

  it('posts a digest when tool and connection are ready', async () => {
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
          metadataJson: { channelLabel: '#standups' },
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
            secretsRef: 'https://hooks.slack.com/services/T/B/x',
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
});
