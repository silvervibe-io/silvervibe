import { Injectable, signal } from '@angular/core';
import {
  User,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { from, Observable } from 'rxjs';

export type SilvervibeFirebaseConfig = FirebaseOptions;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  private initialized = false;

  init(config: SilvervibeFirebaseConfig): void {
    if (this.initialized) {
      return;
    }
    if (!getApps().length) {
      initializeApp(config);
    }
    const auth = getAuth();
    void setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, (user) => this.userSignal.set(user));
    this.initialized = true;
  }

  signIn(email: string, password: string): Observable<User> {
    return from(
      signInWithEmailAndPassword(getAuth(), email, password).then(
        (result) => result.user,
      ),
    );
  }

  signOut(): Observable<void> {
    return from(signOut(getAuth()));
  }

  async idToken(): Promise<string | null> {
    const current = this.userSignal();
    if (!current) {
      return null;
    }
    return current.getIdToken();
  }
}
