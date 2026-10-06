import { Injectable } from '@nestjs/common';
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
};

@Injectable()
export class FirebaseAuthService {
  private ready = false;

  constructor() {
    this.bootstrap();
  }

  private bootstrap(): void {
    if (getApps().length) {
      this.ready = true;
      return;
    }

    const projectId = process.env['FIREBASE_PROJECT_ID'];
    const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
    const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(
      /\\n/g,
      '\n',
    );

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this.ready = true;
      return;
    }

    if (projectId && process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
      this.ready = true;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async verifyIdToken(token: string): Promise<VerifiedUser> {
    if (!this.ready) {
      throw new Error('Firebase Auth is not configured');
    }
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  }

  /** Dev-only path when Firebase is not configured (`Authorization: Bearer dev:<uid>`). */
  parseDevBearer(token: string): VerifiedUser | null {
    if (this.ready || process.env['NODE_ENV'] === 'production') {
      return null;
    }
    if (!token.startsWith('dev:')) {
      return null;
    }
    const uid = token.slice(4);
    return uid ? { uid, email: `${uid}@dev.local` } : null;
  }
}
