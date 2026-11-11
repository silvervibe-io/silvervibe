import { BadRequestException, Injectable } from '@nestjs/common';
import { BitbucketService } from '../addons/bitbucket/bitbucket.service';
import { GithubService } from '../addons/github/github.service';
import { GitlabService } from '../addons/gitlab/gitlab.service';
import { JiraService } from '../addons/jira/jira.service';
import { LinearService } from '../addons/linear/linear.service';
import type { MentionIssue } from '../addons/mention-issue';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class MentionsService {
  constructor(
    private readonly users: UsersService,
    private readonly teams: TeamsService,
    private readonly github: GithubService,
    private readonly gitlab: GitlabService,
    private readonly bitbucket: BitbucketService,
    private readonly jira: JiraService,
    private readonly linear: LinearService,
  ) {}

  async searchIssues(
    teamId: string,
    user: VerifiedUser,
    query: string,
  ): Promise<MentionIssue[]> {
    const q = query.trim();
    if (q.length < 2 || q.length > 80) {
      throw new BadRequestException('mentions.query');
    }
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.teams.requireTeamMember(teamId, userId);
    const [github, gitlab, bitbucket, jira, linear] = await Promise.all([
      this.safe(() => this.github.searchMentionIssues(workspaceId, q)),
      this.safe(() => this.gitlab.searchMentionIssues(workspaceId, q)),
      this.safe(() => this.bitbucket.searchMentionIssues(workspaceId, q)),
      this.safe(() => this.jira.searchMentionIssues(workspaceId, q)),
      this.safe(() => this.linear.searchMentionIssues(workspaceId, q)),
    ]);
    return [...github, ...gitlab, ...bitbucket, ...jira, ...linear];
  }

  async recentIssues(
    teamId: string,
    user: VerifiedUser,
  ): Promise<MentionIssue[]> {
    const userId = (await this.users.upsertFromFirebase(user)).id;
    const { workspaceId } = await this.teams.requireTeamMember(teamId, userId);
    const [github, gitlab, bitbucket, jira, linear] = await Promise.all([
      this.safe(() => this.github.recentMentionIssues(workspaceId)),
      this.safe(() => this.gitlab.recentMentionIssues(workspaceId)),
      this.safe(() => this.bitbucket.recentMentionIssues(workspaceId)),
      this.safe(() => this.jira.recentMentionIssues(workspaceId)),
      this.safe(() => this.linear.recentMentionIssues(workspaceId)),
    ]);
    return [
      ...github.slice(0, 3),
      ...gitlab.slice(0, 3),
      ...bitbucket.slice(0, 3),
      ...jira.slice(0, 3),
      ...linear.slice(0, 3),
    ];
  }

  private async safe(
    load: () => Promise<MentionIssue[]>,
  ): Promise<MentionIssue[]> {
    try {
      return await load();
    } catch {
      return [];
    }
  }
}
