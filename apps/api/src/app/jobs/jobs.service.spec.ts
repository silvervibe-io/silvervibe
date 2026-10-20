import { StandupEntryStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  it('emails members missing a submitted standup for the team-local day', async () => {
    const sendStandupReminder = jest.fn().mockResolvedValue({ sent: true });
    const prisma = {
      isEnabled: () => true,
      workspaceTool: {
        findMany: jest.fn().mockResolvedValue([{ workspaceId: 'ws1' }]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'team1',
            name: 'Alpha',
            standupConfig: { timezone: 'UTC' },
            members: [
              {
                userId: 'u1',
                user: { email: 'a@example.com' },
              },
              {
                userId: 'u2',
                user: { email: 'b@example.com' },
              },
              {
                userId: 'u3',
                user: { email: null },
              },
            ],
          },
        ]),
      },
      standupEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'u2', status: StandupEntryStatus.SUBMITTED },
          ]),
      },
    };

    const service = new JobsService(
      prisma as unknown as PrismaService,
      { sendStandupReminder } as unknown as MailService,
    );

    const result = await service.runStandupReminders();
    expect(result.teamsChecked).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.skippedSubmitted).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    expect(sendStandupReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        teamName: 'Alpha',
      }),
    );
  });
});
