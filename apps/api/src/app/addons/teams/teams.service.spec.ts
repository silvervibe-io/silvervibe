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
  it('reports a ready Microsoft Teams add-on', () => {
    const service = new TeamsService(
      { isEnabled: () => true } as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    expect(service.status()).toEqual({ name: 'teams', status: 'ready' });
  });

  it('connects an Incoming Webhook and enables addons.teams', async () => {
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
          metadataJson: { channelLabel: 'Standups' },
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
      channelLabel: 'Standups',
      toolEnabled: true,
    });
  });

  it('posts a digest when tool and connection are ready', async () => {
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
          metadataJson: { channelLabel: 'Standups' },
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
      entryDate: '2026-10-22',
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
        entryDate: '2026-10-22',
        content: 'hi',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
