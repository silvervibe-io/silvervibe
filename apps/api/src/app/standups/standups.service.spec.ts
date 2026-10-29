import { StandupEntryStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { GithubService } from '../addons/github/github.service';
import { JiraService } from '../addons/jira/jira.service';
import { LinearService } from '../addons/linear/linear.service';
import { SlackService } from '../addons/slack/slack.service';
import { TeamsService as MsTeamsService } from '../addons/teams/teams.service';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { StandupsService } from './standups.service';

const member: VerifiedUser = {
  uid: 'uid-1',
  email: 'member@example.com',
};

const aiStub = {
  summarizeStandup: jest.fn().mockResolvedValue(null),
} as unknown as AiService;

const slackStub = {
  postStandupDigest: jest.fn().mockResolvedValue(false),
} as unknown as SlackService;

const msTeamsStub = {
  postStandupDigest: jest.fn().mockResolvedValue(false),
} as unknown as MsTeamsService;

const linearStub = {
  postStandupDigest: jest.fn().mockResolvedValue(false),
} as unknown as LinearService;

const githubStub = {
  postStandupDigest: jest.fn().mockResolvedValue(false),
} as unknown as GithubService;

const jiraStub = {
  postStandupDigest: jest.fn().mockResolvedValue(false),
} as unknown as JiraService;

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
    const summaryContent = '### Member\n- Today: shipped auto-summary';
    const summaryUpsert = jest.fn().mockResolvedValue({
      id: 's1',
      teamId: 'team1',
      entryDate,
      content: summaryContent,
    });
    const summaryUpdate = jest.fn().mockResolvedValue({});
    const summaryFindUnique = jest.fn().mockResolvedValue(null);

    const prisma = {
      isEnabled: () => true,
      standupConfig: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      standupEntry: { upsert, findMany },
      standupSummary: {
        upsert: summaryUpsert,
        findUnique: summaryFindUnique,
        update: summaryUpdate,
      },
      team: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ workspaceId: 'ws1', name: 'Alpha' }),
      },
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

    const postStandupDigest = jest.fn().mockResolvedValue(true);
    const postTeamsDigest = jest.fn().mockResolvedValue(true);
    const postLinearDigest = jest.fn().mockResolvedValue(true);
    const postGithubDigest = jest.fn().mockResolvedValue(true);
    const postJiraDigest = jest.fn().mockResolvedValue(true);
    const summarizeStandup = jest.fn().mockResolvedValue(null);
    const service = new StandupsService(
      prisma as unknown as PrismaService,
      users,
      teams,
      { summarizeStandup } as unknown as AiService,
      { postStandupDigest } as unknown as SlackService,
      { postStandupDigest: postTeamsDigest } as unknown as MsTeamsService,
      { postStandupDigest: postLinearDigest } as unknown as LinearService,
      { postStandupDigest: postGithubDigest } as unknown as GithubService,
      { postStandupDigest: postJiraDigest } as unknown as JiraService,
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
    expect(postStandupDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        teamName: 'Alpha',
      }),
    );
    expect(postTeamsDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        teamName: 'Alpha',
      }),
    );
    expect(postLinearDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        teamName: 'Alpha',
      }),
    );
    expect(postGithubDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        teamName: 'Alpha',
      }),
    );
    expect(postJiraDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        teamId: 'team1',
        teamName: 'Alpha',
      }),
    );
    expect(summaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: {
          digestDeliveryJson: {
            content: summaryContent,
            providers: {
              slack: true,
              teams: true,
              linear: true,
              github: true,
              jira: true,
            },
          },
        },
      }),
    );
  });

  it('skips digests already delivered for unchanged summary content', async () => {
    const entryDate = new Date('2026-10-20T00:00:00.000Z');
    const content = '### Member\n- Yesterday: y\n- Today: same';
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
          yesterday: 'y',
          today: 'same',
          blockers: null,
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            yesterday: 'y',
            today: 'same',
            blockers: null,
            submittedAt: new Date(),
            user: {
              displayName: 'Member',
              email: 'member@example.com',
              id: 'user-1',
            },
          },
        ]),
      },
      standupSummary: {
        findUnique: jest.fn().mockResolvedValue({
          digestDeliveryJson: {
            content,
            providers: {
              slack: true,
              teams: true,
              linear: true,
              github: true,
              jira: true,
            },
          },
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 's1',
          teamId: 'team1',
          entryDate,
          content,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      team: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ workspaceId: 'ws1', name: 'Alpha' }),
      },
    };

    const postStandupDigest = jest.fn().mockResolvedValue(true);
    const service = new StandupsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: member.email,
        }),
      } as unknown as UsersService,
      {
        requireTeamMember: jest.fn().mockResolvedValue(undefined),
      } as unknown as TeamsService,
      {
        summarizeStandup: jest.fn().mockResolvedValue(null),
      } as unknown as AiService,
      { postStandupDigest } as unknown as SlackService,
      { postStandupDigest: jest.fn() } as unknown as MsTeamsService,
      { postStandupDigest: jest.fn() } as unknown as LinearService,
      { postStandupDigest: jest.fn() } as unknown as GithubService,
      { postStandupDigest: jest.fn() } as unknown as JiraService,
    );

    await service.upsertMine('team1', member, {
      status: 'SUBMITTED',
      yesterday: 'y',
      today: 'same',
      blockers: '',
    });

    expect(postStandupDigest).not.toHaveBeenCalled();
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
      aiStub,
      slackStub,
      msTeamsStub,
      linearStub,
      githubStub,
      jiraStub,
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

  it('prefers AI markdown when summarizeStandup returns content', async () => {
    const entryDate = new Date('2026-10-20T00:00:00.000Z');
    const summaryUpsert = jest.fn().mockResolvedValue({
      id: 's1',
      teamId: 'team1',
      entryDate,
      content: '## AI digest',
    });
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
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            yesterday: null,
            today: 'ok',
            blockers: null,
            submittedAt: new Date(),
            user: {
              displayName: 'Member',
              email: 'member@example.com',
              id: 'user-1',
            },
          },
        ]),
      },
      standupSummary: {
        upsert: summaryUpsert,
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      team: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ workspaceId: 'ws1', name: 'Alpha' }),
      },
    };

    const summarizeStandup = jest.fn().mockResolvedValue('## AI digest');
    const service = new StandupsService(
      prisma as unknown as PrismaService,
      {
        upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
      } as unknown as UsersService,
      {
        requireTeamMember: jest.fn().mockResolvedValue(undefined),
      } as unknown as TeamsService,
      { summarizeStandup } as unknown as AiService,
      slackStub,
      msTeamsStub,
      linearStub,
      githubStub,
      jiraStub,
    );

    await service.upsertMine('team1', member, {
      status: 'SUBMITTED',
      yesterday: '',
      today: 'ok',
      blockers: '',
    });

    expect(summarizeStandup).toHaveBeenCalled();
    expect(summaryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ content: '## AI digest' }),
      }),
    );
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
      aiStub,
      slackStub,
      msTeamsStub,
      linearStub,
      githubStub,
      jiraStub,
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
