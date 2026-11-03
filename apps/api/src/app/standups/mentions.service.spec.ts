import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { GithubService } from '../addons/github/github.service';
import { JiraService } from '../addons/jira/jira.service';
import { LinearService } from '../addons/linear/linear.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { MentionsService } from './mentions.service';

const member: VerifiedUser = { uid: 'uid-1', email: 'ada@example.com' };

describe('MentionsService', () => {
  const users = {
    upsertFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
  };
  const teams = {
    requireTeamMember: jest.fn().mockResolvedValue({
      role: 'MEMBER',
      workspaceId: 'ws1',
    }),
  };
  const github = { searchMentionIssues: jest.fn() };
  const jira = { searchMentionIssues: jest.fn() };
  const linear = { searchMentionIssues: jest.fn() };

  function service(): MentionsService {
    return new MentionsService(
      users as unknown as UsersService,
      teams as unknown as TeamsService,
      github as unknown as GithubService,
      jira as unknown as JiraService,
      linear as unknown as LinearService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    users.upsertFromFirebase.mockResolvedValue({ id: 'user-1' });
    teams.requireTeamMember.mockResolvedValue({
      role: 'MEMBER',
      workspaceId: 'ws1',
    });
  });

  it('rejects a query that is shorter than two characters', async () => {
    await expect(
      service().searchIssues('team-1', member, ' a '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(teams.requireTeamMember).not.toHaveBeenCalled();
  });

  it('requires team membership before searching', async () => {
    teams.requireTeamMember.mockRejectedValue(
      new ForbiddenException('Not a member of this team'),
    );
    await expect(
      service().searchIssues('team-1', member, 'ship'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(github.searchMentionIssues).not.toHaveBeenCalled();
  });

  it('returns the other providers when one search fails', async () => {
    github.searchMentionIssues.mockRejectedValue(new Error('bad credentials'));
    jira.searchMentionIssues.mockResolvedValue([
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
    ]);
    linear.searchMentionIssues.mockResolvedValue([]);

    await expect(
      service().searchIssues('team-1', member, 'ship'),
    ).resolves.toEqual([
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
    ]);
  });
});
