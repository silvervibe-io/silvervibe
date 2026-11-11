import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { BitbucketService } from '../addons/bitbucket/bitbucket.service';
import { TrelloService } from '../addons/trello/trello.service';
import { GithubService } from '../addons/github/github.service';
import { GitlabService } from '../addons/gitlab/gitlab.service';
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
  const github = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };
  const gitlab = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };
  const bitbucket = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };
  const trello = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };
  const jira = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };
  const linear = {
    searchMentionIssues: jest.fn(),
    recentMentionIssues: jest.fn(),
  };

  function service(): MentionsService {
    return new MentionsService(
      users as unknown as UsersService,
      teams as unknown as TeamsService,
      github as unknown as GithubService,
      gitlab as unknown as GitlabService,
      bitbucket as unknown as BitbucketService,
      trello as unknown as TrelloService,
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
    gitlab.searchMentionIssues.mockResolvedValue([
      {
        provider: 'gitlab',
        key: 'acme/app#3',
        title: 'GitLab mention',
        url: 'https://gitlab.com/acme/app/-/issues/3',
      },
    ]);
    linear.searchMentionIssues.mockResolvedValue([]);
    bitbucket.searchMentionIssues.mockResolvedValue([]);
    trello.searchMentionIssues.mockResolvedValue([]);

    await expect(
      service().searchIssues('team-1', member, 'ship'),
    ).resolves.toEqual([
      {
        provider: 'gitlab',
        key: 'acme/app#3',
        title: 'GitLab mention',
        url: 'https://gitlab.com/acme/app/-/issues/3',
      },
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
    ]);
  });

  it('keeps suggestions when one provider cannot list recent work', async () => {
    github.recentMentionIssues.mockRejectedValue(new Error('bad credentials'));
    gitlab.recentMentionIssues.mockResolvedValue([]);
    bitbucket.recentMentionIssues.mockResolvedValue([]);
    trello.recentMentionIssues.mockResolvedValue([]);
    jira.recentMentionIssues.mockResolvedValue([
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
    ]);
    linear.recentMentionIssues.mockResolvedValue([
      {
        provider: 'linear',
        key: 'ENG-4',
        title: 'Standup draft',
        url: 'https://linear.app/acme/issue/ENG-4',
      },
    ]);

    await expect(service().recentIssues('team-1', member)).resolves.toEqual([
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
      {
        provider: 'linear',
        key: 'ENG-4',
        title: 'Standup draft',
        url: 'https://linear.app/acme/issue/ENG-4',
      },
    ]);
  });
});
