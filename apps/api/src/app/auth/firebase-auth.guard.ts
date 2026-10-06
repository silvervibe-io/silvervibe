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
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();

    const devUser = this.firebaseAuth.parseDevBearer(token);
    if (devUser) {
      request.user = devUser;
      return true;
    }

    try {
      request.user = await this.firebaseAuth.verifyIdToken(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}
