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
import { from, Observable } from 'rxjs';

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

  signIn(email: string, password: string): Observable<User> {
    return from(
      signInWithEmailAndPassword(getAuth(), email, password).then(
        (result) => result.user,
      ),
    );
  }

  signInWithGoogle(): Observable<User> {
    return from(
      signInWithPopup(getAuth(), new GoogleAuthProvider()).then(
        (result) => result.user,
      ),
    );
  }

  signInWithGithub(): Observable<User> {
    return from(
      signInWithPopup(getAuth(), new GithubAuthProvider()).then(
        (result) => result.user,
      ),
    );
  }

  signOut(): Observable<void> {
    return from(signOut(getAuth()));
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
