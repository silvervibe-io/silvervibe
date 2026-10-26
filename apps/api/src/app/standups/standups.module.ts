import { Module } from '@nestjs/common';
import { GithubModule } from '../addons/github/github.module';
import { LinearModule } from '../addons/linear/linear.module';
import { SlackModule } from '../addons/slack/slack.module';
import { TeamsModule as MsTeamsModule } from '../addons/teams/teams.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceTeamsModule } from '../teams/teams.module';
import { UsersModule } from '../users/users.module';
import { StandupsController } from './standups.controller';
import { StandupsService } from './standups.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkspaceTeamsModule,
    SlackModule,
    MsTeamsModule,
    LinearModule,
    GithubModule,
  ],
  controllers: [StandupsController],
  providers: [StandupsService],
})
export class StandupsModule {}
