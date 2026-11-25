import {
  ApplicationConfig,
  computed,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import {
  AuthService,
  FeatureFlagsService,
  provideSilvervibeAuth,
  provideSilvervibeFeatureFlags,
} from '@silvervibe/shared/auth';
import { provideSilvervibeI18n } from '@silvervibe/shared/i18n';
import { SHELL_LINKS, provideSilvervibeTheme } from '@silvervibe/shared/ui';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { meetingShellLinks } from '@silvervibe/stores/meeting';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

function initPlatform(): Promise<void> {
  const auth = inject(AuthService);
  const flags = inject(FeatureFlagsService);
  auth.init(environment.firebase);
  return flags.init(environment.growthbook);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideSilvervibeTheme(),
    provideSilvervibeAuth(environment.firebase, {
      apiBaseUrl: environment.apiBaseUrl,
    }),
    provideSilvervibeApiClient(),
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
    {
      provide: SHELL_LINKS,
      useFactory: () => {
        const transloco = inject(TranslocoService);
        const lang = toSignal(transloco.langChanges$, {
          initialValue: transloco.getActiveLang(),
        });
        return computed(() => {
          lang();
          return meetingShellLinks((key) => transloco.translate(key));
        });
      },
    },
    ...provideSilvervibeI18n(),
    provideAppInitializer(initPlatform),
  ],
};
