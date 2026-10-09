import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { VerifiedUser } from '../auth/firebase-auth.service';
import { UsersService } from './users.service';
import { MeDto } from './me.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Current authenticated user',
    description:
      'Requires `Authorization: Bearer <Firebase ID token>`. ' +
      'Upserts the Neon `users` row by `firebase_uid`. ' +
      'Outside production, when Firebase Admin is not configured, `Bearer dev:<uid>` is accepted.',
  })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired Bearer token',
  })
  async me(@CurrentUser() user: VerifiedUser): Promise<MeDto> {
    const record = await this.users.upsertFromFirebase(user);
    return {
      id: record.id,
      firebaseUid: record.firebaseUid,
      email: record.email,
      displayName: record.displayName ?? null,
    };
  }
}
