import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BitbucketModule } from '../addons/bitbucket/bitbucket.module';
import { TrelloModule } from '../addons/trello/trello.module';
import { GithubModule } from '../addons/github/github.module';
import { GitlabModule } from '../addons/gitlab/gitlab.module';
import { JiraModule } from '../addons/jira/jira.module';
import { LinearModule } from '../addons/linear/linear.module';
import { SlackModule } from '../addons/slack/slack.module';
import { TeamsModule as MsTeamsModule } from '../addons/teams/teams.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceTeamsModule } from '../teams/teams.module';
import { UsersModule } from '../users/users.module';
import { MentionsService } from './mentions.service';
import { StandupsController } from './standups.controller';
import { StandupsService } from './standups.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkspaceTeamsModule,
    AiModule,
    SlackModule,
    MsTeamsModule,
    LinearModule,
    GithubModule,
    GitlabModule,
    BitbucketModule,
    TrelloModule,
    JiraModule,
  ],
  controllers: [StandupsController],
  providers: [StandupsService, MentionsService],
  exports: [StandupsService],
})
export class StandupsModule {}
