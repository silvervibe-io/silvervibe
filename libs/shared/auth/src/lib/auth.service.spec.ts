import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { FIREBASE_WEB_CONFIG } from './firebase-web-config.token';

describe('AuthService', () => {
  it('starts with no user and becomes ready without Firebase config', async () => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: FIREBASE_WEB_CONFIG,
          useValue: { apiKey: '', projectId: '' },
        },
      ],
    });
    const service = TestBed.inject(AuthService);
    service.init();

    expect(service.user()).toBeNull();
    await expect(service.whenReady()).resolves.toBeUndefined();
    expect(service.ready()).toBe(true);
    await expect(service.idToken()).resolves.toBeNull();
  });

  it('throws a clear error when Google sign-in runs without Firebase config', async () => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: FIREBASE_WEB_CONFIG,
          useValue: { apiKey: '', projectId: '' },
        },
      ],
    });
    const service = TestBed.inject(AuthService);
    service.init();
    await expect(service.signInWithGoogle()).rejects.toThrow(
      /Firebase Auth is not configured/,
    );
  });
});
