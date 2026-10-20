import { StandupEntryStatus } from '@prisma/client';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { StandupsService } from './standups.service';

const member: VerifiedUser = {
  uid: 'uid-1',
  email: 'member@example.com',
};

describe('StandupsService auto-summary', () => {
  it('rebuilds the team summary after a submit', async () => {
    const entryDate = new Date('2026-10-20T00:00:00.000Z');
    const upsert = jest.fn().mockResolvedValue({
      id: 'e1',
      teamId: 'team1',
      entryDate,
      status: StandupEntryStatus.SUBMITTED,
      yesterday: 'y',
      today: 'shipped auto-summary',
      blockers: null,
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        userId: 'user-1',
        yesterday: 'y',
        today: 'shipped auto-summary',
        blockers: null,
        submittedAt: new Date(),
        user: {
          displayName: 'Member',
          email: 'member@example.com',
          id: 'user-1',
        },
      },
    ]);
    const summaryUpsert = jest.fn().mockResolvedValue({
      id: 's1',
      teamId: 'team1',
      entryDate,
      content: '### Member\n- Today: shipped auto-summary',
    });

    const prisma = {
      isEnabled: () => true,
      standupConfig: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      standupEntry: { upsert, findMany },
      standupSummary: { upsert: summaryUpsert },
    };

    const users = {
      upsertFromFirebase: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: member.email,
      }),
    } as unknown as UsersService;

    const teams = {
      requireTeamMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as TeamsService;

    const service = new StandupsService(
      prisma as unknown as PrismaService,
      users,
      teams,
    );

    const result = await service.upsertMine('team1', member, {
      status: 'SUBMITTED',
      yesterday: 'y',
      today: 'shipped auto-summary',
      blockers: '',
    });

    expect(result.status).toBe('SUBMITTED');
    expect(findMany).toHaveBeenCalled();
    expect(summaryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          content: expect.stringContaining('shipped auto-summary'),
        }),
      }),
    );
  });

  it('still returns the entry when summary rebuild fails', async () => {
    const entryDate = new Date('2026-10-20T00:00:00.000Z');
    const prisma = {
      isEnabled: () => true,
      standupConfig: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      standupEntry: {
        upsert: jest.fn().mockResolvedValue({
          id: 'e1',
          teamId: 'team1',
          entryDate,
          status: StandupEntryStatus.SUBMITTED,
          yesterday: null,
          today: 'ok',
          blockers: null,
        }),
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
      standupSummary: { upsert: jest.fn() },
    };

    const service = new StandupsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
      {
        requireTeamMember: jest.fn().mockResolvedValue(undefined),
      } as unknown as TeamsService,
    );

    await expect(
      service.upsertMine('team1', member, {
        status: 'SUBMITTED',
        yesterday: '',
        today: 'ok',
        blockers: '',
      }),
    ).resolves.toMatchObject({ id: 'e1', status: 'SUBMITTED' });
    expect(prisma.standupSummary.upsert).not.toHaveBeenCalled();
  });

  it('does not rebuild summary for drafts', async () => {
    const entryDate = new Date('2026-10-20T00:00:00.000Z');
    const findMany = jest.fn();
    const prisma = {
      isEnabled: () => true,
      standupConfig: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      standupEntry: {
        upsert: jest.fn().mockResolvedValue({
          id: 'e1',
          teamId: 'team1',
          entryDate,
          status: StandupEntryStatus.DRAFT,
          yesterday: null,
          today: 'draft',
          blockers: null,
        }),
        findMany,
      },
      standupSummary: { upsert: jest.fn() },
    };

    const service = new StandupsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
      {
        requireTeamMember: jest.fn().mockResolvedValue(undefined),
      } as unknown as TeamsService,
    );

    await service.upsertMine('team1', member, {
      status: 'DRAFT',
      yesterday: '',
      today: 'draft',
      blockers: '',
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
