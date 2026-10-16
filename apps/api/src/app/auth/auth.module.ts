import { Module } from '@nestjs/common';
import { AuthHandoffController } from './auth-handoff.controller';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  controllers: [AuthHandoffController],
  providers: [FirebaseAuthService, FirebaseAuthGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard],
})
export class AuthModule {}
