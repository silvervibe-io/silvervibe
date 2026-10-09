jest.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
  cert: jest.fn((value) => value),
  applicationDefault: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn(),
  }),
}));

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthGuard', () => {
  const firebaseAuth = {
    parseDevBearer: jest.fn(),
    isReady: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  const guard = new FirebaseAuthGuard(
    firebaseAuth as unknown as FirebaseAuthService,
  );

  function contextWithAuth(authorization?: string): ExecutionContext {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects missing Authorization header', async () => {
    await expect(guard.canActivate(contextWithAuth())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts dev bearer when parseDevBearer returns a user', async () => {
    firebaseAuth.parseDevBearer.mockReturnValue({
      uid: 'alice',
      email: 'alice@dev.local',
    });
    const ctx = contextWithAuth('Bearer dev:alice');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual({
      uid: 'alice',
      email: 'alice@dev.local',
    });
  });

  it('rejects when Firebase is not ready and token is not dev', async () => {
    firebaseAuth.parseDevBearer.mockReturnValue(null);
    firebaseAuth.isReady.mockReturnValue(false);
    await expect(
      guard.canActivate(contextWithAuth('Bearer not-a-dev-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a verified Firebase ID token', async () => {
    firebaseAuth.parseDevBearer.mockReturnValue(null);
    firebaseAuth.isReady.mockReturnValue(true);
    firebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'fb-1',
      email: 'user@example.com',
      displayName: 'User',
    });
    const ctx = contextWithAuth('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual({
      uid: 'fb-1',
      email: 'user@example.com',
      displayName: 'User',
    });
  });

  it('rejects invalid Firebase tokens', async () => {
    firebaseAuth.parseDevBearer.mockReturnValue(null);
    firebaseAuth.isReady.mockReturnValue(true);
    firebaseAuth.verifyIdToken.mockRejectedValue(new Error('bad token'));
    await expect(
      guard.canActivate(contextWithAuth('Bearer bad')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
