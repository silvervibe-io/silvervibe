import { Injectable, signal } from '@angular/core';
import {
  User,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
} from 'firebase/auth';
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';

export type SilvervibeFirebaseConfig = FirebaseOptions;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();

  private readonly readySignal = signal(false);
  readonly ready = this.readySignal.asReadonly();

  private initialized = false;
  private resolveReady!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  init(config: SilvervibeFirebaseConfig): void {
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
      this.readySignal.set(true);
      this.resolveReady();
      return Promise.resolve();
    }
    return this.readyPromise;
  }

  async signIn(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(getAuth(), email, password);
    return result.user;
  }

  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(getAuth(), new GoogleAuthProvider());
    return result.user;
  }

  async signInWithGithub(): Promise<User> {
    const result = await signInWithPopup(getAuth(), new GithubAuthProvider());
    return result.user;
  }

  async signOut(): Promise<void> {
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
}
