import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { GithubModule } from './addons/github/github.module';
import { JiraModule } from './addons/jira/jira.module';
import { LinearModule } from './addons/linear/linear.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlackModule } from './addons/slack/slack.module';
import { TeamsModule } from './addons/teams/teams.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    FeatureFlagsModule,
    SlackModule,
    TeamsModule,
    JiraModule,
    LinearModule,
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
