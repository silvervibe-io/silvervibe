import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import { AuthService, SilvervibeFirebaseConfig } from './auth.service';
import {
  FeatureFlagsConfig,
  FeatureFlagsService,
} from './feature-flags.service';

export function provideSilvervibeAuth(
  _firebase: SilvervibeFirebaseConfig,
): EnvironmentProviders {
  return makeEnvironmentProviders([AuthService]);
}

export function provideSilvervibeFeatureFlags(
  _config: FeatureFlagsConfig = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([FeatureFlagsService]);
}
