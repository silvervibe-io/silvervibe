import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GithubModule } from '../addons/github/github.module';
import { JiraModule } from '../addons/jira/jira.module';
import { LinearModule } from '../addons/linear/linear.module';
import { SlackModule } from '../addons/slack/slack.module';
import { TeamsModule as MsTeamsModule } from '../addons/teams/teams.module';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { WorkspaceTeamsModule } from '../teams/teams.module';
import { UsersModule } from '../users/users.module';
import { MentionsService } from './mentions.service';
import { StandupsController } from './standups.controller';
import { StandupsService } from './standups.service';

@Module({
  imports: [
    AuthModule,
    FeatureFlagsModule,
    UsersModule,
    WorkspaceTeamsModule,
    AiModule,
    SlackModule,
    MsTeamsModule,
    LinearModule,
    GithubModule,
    JiraModule,
  ],
  controllers: [StandupsController],
  providers: [StandupsService, MentionsService],
  exports: [StandupsService],
})
export class StandupsModule {}
