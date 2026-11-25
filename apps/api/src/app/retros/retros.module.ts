import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { RetrosController } from './retros.controller';
import { RetrosService } from './retros.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [RetrosController],
  providers: [RetrosService],
  exports: [RetrosService],
})
export class RetrosModule {}
