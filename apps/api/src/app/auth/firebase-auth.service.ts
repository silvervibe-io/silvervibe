import { Injectable, Logger } from '@nestjs/common';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export type VerifiedUser = {
  uid: string;
  email?: string;
  displayName?: string;
};

@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private ready = false;

  constructor() {
    this.bootstrap();
  }

  private bootstrap(): void {
    if (getApps().length) {
      this.ready = true;
      return;
    }

    const projectId = process.env['FIREBASE_PROJECT_ID']?.trim();
    const clientEmail = process.env['FIREBASE_CLIENT_EMAIL']?.trim();
    const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(
      /\\n/g,
      '\n',
    );
    const adcPath = process.env['GOOGLE_APPLICATION_CREDENTIALS']?.trim();

    try {
      if (projectId && clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.ready = true;
        this.logger.log('Firebase Admin initialized (service account env)');
        return;
      }

      if (projectId && adcPath) {
        initializeApp({
          credential: applicationDefault(),
          projectId,
        });
        this.ready = true;
        this.logger.log(
          'Firebase Admin initialized (GOOGLE_APPLICATION_CREDENTIALS)',
        );
        return;
      }
    } catch (error) {
      this.ready = false;
      this.logger.error(
        'Firebase Admin failed to initialize; ID token verification disabled',
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    this.logger.warn(
      'Firebase Admin not configured; Bearer dev:<uid> allowed outside production only',
    );
  }

  isReady(): boolean {
    return this.ready;
  }

  async verifyIdToken(token: string): Promise<VerifiedUser> {
    if (!this.ready) {
      throw new Error('Firebase Auth is not configured');
    }
    const decoded = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name,
    };
  }

  /** Dev-only path when Firebase is not configured (`Authorization: Bearer dev:<uid>`). */
  parseDevBearer(token: string): VerifiedUser | null {
    if (this.ready || process.env['NODE_ENV'] === 'production') {
      return null;
    }
    if (!token.startsWith('dev:')) {
      return null;
    }
    const uid = token.slice(4).trim();
    return uid ? { uid, email: `${uid}@dev.local`, displayName: uid } : null;
  }
}
