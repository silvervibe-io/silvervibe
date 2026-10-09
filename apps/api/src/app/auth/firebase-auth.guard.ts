import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAuthService, VerifiedUser } from './firebase-auth.service';

export type AuthedRequest = {
  headers: { authorization?: string };
  user?: VerifiedUser;
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing Authorization Bearer token (Firebase ID token)',
      );
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty Bearer token');
    }

    const devUser = this.firebaseAuth.parseDevBearer(token);
    if (devUser) {
      request.user = devUser;
      return true;
    }

    if (!this.firebaseAuth.isReady()) {
      throw new UnauthorizedException(
        'Firebase Admin is not configured; use a Firebase ID token after setup, or Bearer dev:<uid> in non-production',
      );
    }

    try {
      request.user = await this.firebaseAuth.verifyIdToken(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}
