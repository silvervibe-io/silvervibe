import { AddonConnectionStatus, WorkspaceRole } from '@prisma/client';
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

  it('skips digest while Teams product support is deferred (#108)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new TeamsService(
      { isEnabled: () => true } as unknown as PrismaService,
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
