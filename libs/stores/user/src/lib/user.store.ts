import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@silvervibe/shared/auth';

/** Neon profile from `GET /api/me` (upserted from Firebase). */
export type UserProfile = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

type UserState = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
};

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);
    const apiBase = inject(API_BASE_URL);

    return {
      async loadMe(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const profile = await firstValueFrom(
            http.get<UserProfile>(`${apiBase}/me`),
          );
          patchState(store, { profile, loading: false, error: null });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load /api/me',
          });
        }
      },

      clear(): void {
        patchState(store, initialState);
      },
    };
  }),
);

export type UserStore = InstanceType<typeof UserStore>;
