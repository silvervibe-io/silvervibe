import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceTeamsModule } from '../teams/teams.module';
import { UsersModule } from '../users/users.module';
import { StandupsController } from './standups.controller';
import { StandupsService } from './standups.service';

@Module({
  imports: [AuthModule, UsersModule, WorkspaceTeamsModule],
  controllers: [StandupsController],
  providers: [StandupsService],
})
export class StandupsModule {}
