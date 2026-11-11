import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../../users/users.module';
import { TrelloController } from './trello.controller';
import { TrelloService } from './trello.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [TrelloController],
  providers: [TrelloService],
  exports: [TrelloService],
})
export class TrelloModule {}
