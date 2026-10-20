import type { MeDto } from '@silvervibe/shared/api-client';

/** Neon profile from `GET /api/me` (upserted from Firebase). */
export type UserProfile = MeDto;

export type UserState = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
};

export const USER_INITIAL_STATE: UserState = {
  profile: null,
  loading: false,
  error: null,
};
