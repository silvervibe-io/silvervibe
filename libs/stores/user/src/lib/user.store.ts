import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { USER_INITIAL_STATE } from './user.models';
import { UserService } from './user.service';

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(USER_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(UserService);

    return {
      async loadMe(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const profile = await api.getMe();
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
        patchState(store, USER_INITIAL_STATE);
      },
    };
  }),
);

export type UserStore = InstanceType<typeof UserStore>;
