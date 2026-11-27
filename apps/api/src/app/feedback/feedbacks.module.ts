import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
  exports: [FeedbacksService],
})
export class FeedbacksModule {}
