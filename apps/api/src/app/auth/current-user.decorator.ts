import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest } from './firebase-auth.guard';
import { VerifiedUser } from './firebase-auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VerifiedUser => {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.user) {
      throw new Error('CurrentUser used without FirebaseAuthGuard');
    }
    return request.user;
  },
);
