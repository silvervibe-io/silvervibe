import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  AuthService,
  FeatureFlagsService,
  provideSilvervibeAuth,
  provideSilvervibeFeatureFlags,
} from '@silvervibe/shared/auth';
import { provideSilvervibeI18n } from '@silvervibe/shared/i18n';
import { provideSilvervibeTheme } from '@silvervibe/shared/ui';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

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
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideSilvervibeTheme(),
    provideSilvervibeAuth(environment.firebase, {
      apiBaseUrl: environment.apiBaseUrl,
    }),
    provideSilvervibeFeatureFlags(environment.growthbook),
    ...provideSilvervibeI18n(),
    {
      provide: APP_INITIALIZER,
      useFactory: initPlatform,
      multi: true,
    },
  ],
};
