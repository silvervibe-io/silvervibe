import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StandupsModule } from '../../standups/standups.module';
import { UsersModule } from '../../users/users.module';
import { SlackCheckinService } from './slack-checkin.service';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    forwardRef(() => StandupsModule),
  ],
  controllers: [SlackController],
  providers: [SlackService, SlackCheckinService],
  exports: [SlackService],
})
export class SlackModule {}
