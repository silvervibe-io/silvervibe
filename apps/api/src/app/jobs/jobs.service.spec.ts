import { StandupEntryStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  const nowInWindow = new Date('2026-06-15T09:07:00.000Z'); // 09:07 UTC

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
            standupConfig: {
              timezone: 'UTC',
              reminderHour: 9,
              reminderMinute: 0,
            },
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
      standupAway: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new JobsService(
      prisma as unknown as PrismaService,
      { sendStandupReminder } as unknown as MailService,
    );

    const result = await service.runStandupReminders(nowInWindow);
    expect(result.teamsChecked).toBe(1);
    expect(result.emailed).toBe(1);
    expect(result.skippedSubmitted).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    expect(result.skippedOutsideWindow).toBe(0);
    expect(sendStandupReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        teamName: 'Alpha',
        windowLabel: 'Post before 09:00 (UTC).',
      }),
    );
  });

  it('does not email a member before their work day starts', async () => {
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
            standupConfig: {
              timezone: 'UTC',
              reminderHour: 14,
              reminderMinute: 0,
            },
            members: [
              {
                userId: 'u1',
                user: {
                  email: 'a@example.com',
                  timezone: 'UTC',
                  workHoursJson: {
                    mon: { enabled: true, start: '14:00', end: '18:00' },
                  },
                },
              },
            ],
          },
        ]),
      },
      standupEntry: {
        findMany: jest.fn(),
      },
      standupAway: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new JobsService(
      prisma as unknown as PrismaService,
      { sendStandupReminder } as unknown as MailService,
    );

    const result = await service.runStandupReminders(nowInWindow);
    expect(result.teamsChecked).toBe(1);
    expect(result.skippedOutsideWindow).toBe(1);
    expect(result.emailed).toBe(0);
    expect(sendStandupReminder).not.toHaveBeenCalled();
    expect(prisma.standupEntry.findMany).not.toHaveBeenCalled();
  });

  it('does not email a member who is away', async () => {
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
            standupConfig: {
              timezone: 'UTC',
              reminderHour: 9,
              reminderMinute: 0,
            },
            members: [
              {
                userId: 'u1',
                user: { email: 'a@example.com' },
              },
            ],
          },
        ]),
      },
      standupEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      standupAway: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }]),
      },
    };

    const service = new JobsService(
      prisma as unknown as PrismaService,
      { sendStandupReminder } as unknown as MailService,
    );

    const result = await service.runStandupReminders(nowInWindow);
    expect(result.skippedAway).toBe(1);
    expect(result.emailed).toBe(0);
    expect(sendStandupReminder).not.toHaveBeenCalled();
  });

  it('emails each member at their own work-day start', async () => {
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
            standupConfig: {
              timezone: 'UTC',
              scheduleKind: 'WINDOW',
              windowStartHour: 8,
              windowStartMinute: 0,
              reminderHour: 10,
              reminderMinute: 0,
            },
            members: [
              {
                userId: 'ny',
                user: {
                  email: 'ny@example.com',
                  timezone: 'America/New_York',
                  workHoursJson: {
                    mon: { enabled: true, start: '09:00', end: '17:00' },
                  },
                },
              },
              {
                userId: 'ath',
                user: {
                  email: 'ath@example.com',
                  timezone: 'Europe/Athens',
                  workHoursJson: {
                    mon: { enabled: true, start: '09:00', end: '17:00' },
                  },
                },
              },
            ],
          },
        ]),
      },
      standupEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      standupAway: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new JobsService(
      prisma as unknown as PrismaService,
      { sendStandupReminder } as unknown as MailService,
    );

    const result = await service.runStandupReminders(
      new Date('2026-06-15T13:07:00.000Z'),
    );
    expect(result.emailed).toBe(1);
    expect(result.skippedOutsideWindow).toBe(1);
    expect(sendStandupReminder).toHaveBeenCalledTimes(1);
    expect(sendStandupReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ny@example.com',
        windowLabel: 'Post between 04:00 and 06:00 (America/New_York).',
      }),
    );
  });
});
