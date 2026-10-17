import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { API_BASE_URL } from './api-base-url.token';
import { AuthService, SilvervibeFirebaseConfig } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { FIREBASE_WEB_CONFIG } from './firebase-web-config.token';
import {
  FeatureFlagsConfig,
  FeatureFlagsService,
} from './feature-flags.service';

export type ProvideSilvervibeAuthOptions = {
  apiBaseUrl?: string;
};

export function provideSilvervibeAuth(
  firebase: SilvervibeFirebaseConfig,
  options: ProvideSilvervibeAuthOptions = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([
    AuthService,
    { provide: FIREBASE_WEB_CONFIG, useValue: firebase },
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: API_BASE_URL,
      useValue: options.apiBaseUrl ?? '/api',
    },
  ]);
}

export function provideSilvervibeFeatureFlags(
  _config: FeatureFlagsConfig = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([FeatureFlagsService]);
}
