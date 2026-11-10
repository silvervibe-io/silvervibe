import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../../users/users.module';
import { GitlabController } from './gitlab.controller';
import { GitlabService } from './gitlab.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [GitlabController],
  providers: [GitlabService],
  exports: [GitlabService],
})
export class GitlabModule {}
