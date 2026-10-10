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
  const envKeys = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'NODE_ENV',
  ] as const;

  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of envKeys) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  async function createService(): Promise<FirebaseAuthService> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FirebaseAuthService],
    }).compile();
    return moduleRef.get(FirebaseAuthService);
  }

  it('parses dev bearer tokens when Firebase is not configured', async () => {
    const service = await createService();
    expect(service.isReady()).toBe(false);
    expect(service.parseDevBearer('dev:alice')).toEqual({
      uid: 'alice',
      email: 'alice@dev.local',
      displayName: 'alice',
    });
  });

  it('rejects non-dev tokens without Firebase', async () => {
    const service = await createService();
    expect(service.parseDevBearer('real-token')).toBeNull();
  });

  it('disables dev bearer when Firebase Admin is ready', async () => {
    process.env['FIREBASE_PROJECT_ID'] = 'demo';
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] = './fake.json';
    const service = await createService();
    expect(service.isReady()).toBe(true);
    expect(service.parseDevBearer('dev:alice')).toBeNull();
  });
});
