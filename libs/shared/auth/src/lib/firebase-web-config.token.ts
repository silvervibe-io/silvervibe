import { InjectionToken } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';

/** Web Firebase options from app `environment.firebase` (synced from `.env`). */
export const FIREBASE_WEB_CONFIG = new InjectionToken<FirebaseOptions>(
  'FIREBASE_WEB_CONFIG',
  { factory: () => ({}) },
);
