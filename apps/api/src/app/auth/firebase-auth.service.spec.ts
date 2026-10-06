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

import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService', () => {
  let service: FirebaseAuthService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FirebaseAuthService],
    }).compile();
    service = moduleRef.get(FirebaseAuthService);
  });

  it('parses dev bearer tokens when Firebase is not configured', () => {
    expect(service.parseDevBearer('dev:alice')).toEqual({
      uid: 'alice',
      email: 'alice@dev.local',
    });
  });

  it('rejects non-dev tokens without Firebase', () => {
    expect(service.parseDevBearer('real-token')).toBeNull();
  });
});
