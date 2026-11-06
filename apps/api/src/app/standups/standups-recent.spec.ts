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

const user: VerifiedUser = { uid: 'uid-1', email: 'member@example.com' };
const now = new Date('2026-11-06T10:00:00.000Z');

function service(role: 'MEMBER' | 'ADMIN'): StandupsService {
  const prisma = {
    isEnabled: () => true,
    standupConfig: {
      findUnique: jest.fn().mockResolvedValue({
        timezone: 'UTC',
        reveal: 'TOGETHER',
        reminderHour: 17,
        reminderMinute: 0,
      }),
    },
    standupSummary: {
      findMany: jest.fn().mockResolvedValue([
        {
          entryDate: new Date('2026-11-06T00:00:00.000Z'),
          content: '### Needs help\n- Today is hidden',
        },
        {
          entryDate: new Date('2026-11-05T00:00:00.000Z'),
          content: '### Needs help\n- Yesterday stays',
        },
      ]),
    },
  };
  const users = {
    upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
  };
  const teams = {
    requireTeamMember: jest
      .fn()
      .mockResolvedValue({ role, workspaceId: 'ws1' }),
  };
  return new StandupsService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    teams as unknown as TeamsService,
    {} as AiService,
    {} as SlackService,
    {} as MsTeamsService,
    {} as LinearService,
    {} as GithubService,
    {} as JiraService,
  );
}

describe('StandupsService recent summaries', () => {
  it('hides today until the together time and keeps earlier days', async () => {
    const days = await service('MEMBER').listRecent('team1', user, now);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ entryDate: '2026-11-06', content: null });
    expect(days[1]).toEqual({
      entryDate: '2026-11-05',
      content: '### Needs help\n- Yesterday stays',
    });
    expect(days[2]).toEqual({ entryDate: '2026-11-04', content: null });
  });

  it('lets a team admin read today before the together time', async () => {
    const days = await service('ADMIN').listRecent('team1', user, now);
    expect(days[0]?.content).toContain('Today is hidden');
  });
});
