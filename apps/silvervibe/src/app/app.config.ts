import {
  ApplicationConfig,
  APP_INITIALIZER,
  computed,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  AuthService,
  FeatureFlagsService,
  provideSilvervibeAuth,
  provideSilvervibeFeatureFlags,
  STANDUP_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import { provideSilvervibeI18n } from '@silvervibe/shared/i18n';
import { provideSilvervibeTheme } from '@silvervibe/shared/ui';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

function initPlatform() {
  const auth = inject(AuthService);
  const flags = inject(FeatureFlagsService);
  return () => {
    auth.init(environment.firebase);
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
    {
      provide: STANDUP_APP_ORIGIN,
      useValue: environment.standupAppOrigin,
    },
    provideSilvervibeFeatureFlags(environment.growthbook),
    {
      provide: PREVIEW_SWITCHER_EMAILS,
      useValue: environment.previewSwitcherEmails,
    },
    {
      provide: PREVIEW_SWITCHER_USER_EMAIL,
      useFactory: () => {
        const auth = inject(AuthService);
        return computed(() => auth.user()?.email ?? null);
      },
    },
    ...provideSilvervibeI18n(),
    {
      provide: APP_INITIALIZER,
      useFactory: initPlatform,
      multi: true,
    },
  ],
};
