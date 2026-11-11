import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../../users/users.module';
import { BitbucketController } from './bitbucket.controller';
import { BitbucketService } from './bitbucket.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [BitbucketController],
  providers: [BitbucketService],
  exports: [BitbucketService],
})
export class BitbucketModule {}
