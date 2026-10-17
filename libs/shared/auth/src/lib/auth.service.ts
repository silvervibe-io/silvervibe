import { inject, Injectable, signal } from '@angular/core';
import {
  User,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  type Auth,
} from 'firebase/auth';

import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { FIREBASE_WEB_CONFIG } from './firebase-web-config.token';

export type SilvervibeFirebaseConfig = FirebaseOptions;

const NOT_CONFIGURED =
  'Firebase Auth is not configured. Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID in .env, run npm run firebase:sync-web, then restart the app.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly defaultConfig = inject(FIREBASE_WEB_CONFIG, {
    optional: true,
  });

  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();

  private readonly readySignal = signal(false);
  readonly ready = this.readySignal.asReadonly();

  private initialized = false;
  private resolveReady!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  init(config: SilvervibeFirebaseConfig = this.defaultConfig ?? {}): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (!config.apiKey || !config.projectId) {
      this.readySignal.set(true);
      this.resolveReady();
      return;
    }

    if (!getApps().length) {
      initializeApp(config);
    }
    const auth = getAuth();
    void setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, (user) => {
      this.userSignal.set(user);
      this.readySignal.set(true);
      this.resolveReady();
    });
  }

  whenReady(): Promise<void> {
    if (this.readySignal()) {
      return Promise.resolve();
    }
    if (!this.initialized) {
      this.init();
    }
    if (this.readySignal()) {
      return Promise.resolve();
    }
    return this.readyPromise;
  }

  async signIn(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(
      this.requireAuth(),
      email,
      password,
    );
    return result.user;
  }

  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(
      this.requireAuth(),
      new GoogleAuthProvider(),
    );
    return result.user;
  }

  async signInWithGithub(): Promise<User> {
    const result = await signInWithPopup(
      this.requireAuth(),
      new GithubAuthProvider(),
    );
    return result.user;
  }

  async signInWithCustomToken(customToken: string): Promise<User> {
    const result = await signInWithCustomToken(this.requireAuth(), customToken);
    return result.user;
  }

  async signOut(): Promise<void> {
    if (!getApps().length) {
      this.userSignal.set(null);
      return;
    }
    await signOut(getAuth());
  }

  async idToken(): Promise<string | null> {
    await this.whenReady();
    const current = this.userSignal();
    if (!current) {
      return null;
    }
    return current.getIdToken();
  }

  private requireAuth(): Auth {
    this.init();
    if (!getApps().length) {
      throw new Error(NOT_CONFIGURED);
    }
    return getAuth();
  }
}
