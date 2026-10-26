import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../../users/users.module';
import { LinearController } from './linear.controller';
import { LinearService } from './linear.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [LinearController],
  providers: [LinearService],
  exports: [LinearService],
})
export class LinearModule {}
