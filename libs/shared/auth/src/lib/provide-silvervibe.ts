import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthService, SilvervibeFirebaseConfig } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import {
  FeatureFlagsConfig,
  FeatureFlagsService,
} from './feature-flags.service';

export function provideSilvervibeAuth(
  _firebase: SilvervibeFirebaseConfig,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ]);
}

export function provideSilvervibeFeatureFlags(
  _config: FeatureFlagsConfig = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([FeatureFlagsService]);
}
