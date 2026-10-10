import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import {
  AuthService,
  FeatureFlagsService,
  provideSilvervibeAuth,
  provideSilvervibeFeatureFlags,
} from '@silvervibe/shared/auth';
import { provideSilvervibeTheme } from '@silvervibe/shared/ui';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import * as fromApp from './+state/app.reducer';
import { AppEffects } from './+state/app.effects';
import { standupFeature } from './standup/standup.reducer';

function initPlatform() {
  const auth = inject(AuthService);
  const flags = inject(FeatureFlagsService);
  return () => {
    if (environment.firebase.apiKey && environment.firebase.projectId) {
      auth.init(environment.firebase);
    }
    return flags.init(environment.growthbook);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(),
    provideState(fromApp.APP_FEATURE_KEY, fromApp.appReducer),
    provideState(standupFeature),
    provideEffects(AppEffects),
    provideStoreDevtools({ logOnly: !isDevMode() }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideSilvervibeTheme(),
    provideSilvervibeAuth(environment.firebase),
    provideSilvervibeFeatureFlags(environment.growthbook),
    {
      provide: APP_INITIALIZER,
      useFactory: initPlatform,
      multi: true,
    },
  ],
};
