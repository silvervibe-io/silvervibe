import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { BASE_PATH } from './generated/variables';

/**
 * Wire OpenAPI Generator's `BASE_PATH` to the app `API_BASE_URL`.
 *
 * Nest OpenAPI paths already include the global `/api` prefix (`/api/me`, …),
 * while `API_BASE_URL` is typically `/api` or `https://host/api`. Strip the
 * trailing `/api` so the client does not call `/api/api/me`.
 */
export function provideSilvervibeApiClient(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: BASE_PATH,
      useFactory: (apiBaseUrl: string): string =>
        apiBaseUrl.replace(/\/?api\/?$/i, ''),
      deps: [API_BASE_URL],
    },
  ]);
}
