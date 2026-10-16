import {
  Controller,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAuthService, VerifiedUser } from './firebase-auth.service';

class CustomTokenDto {
  @ApiProperty()
  customToken!: string;
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthHandoffController {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  @Post('custom-token')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Create a Firebase custom token for cross-app handoff',
    description:
      'Caller sends a valid ID token; response is a short-lived custom token ' +
      'consumable via `signInWithCustomToken` on another authorized domain.',
  })
  @ApiOkResponse({ type: CustomTokenDto })
  @ApiUnauthorizedResponse()
  async customToken(
    @CurrentUser() user: VerifiedUser,
  ): Promise<CustomTokenDto> {
    if (!this.firebaseAuth.isReady()) {
      // Local/dev without Admin: echo a sentinel the client can ignore.
      if (process.env['NODE_ENV'] === 'production') {
        throw new ServiceUnavailableException('Firebase Admin not configured');
      }
      return { customToken: `dev-handoff:${user.uid}` };
    }
    const customToken = await this.firebaseAuth.createCustomToken(user.uid);
    return { customToken };
  }
}
