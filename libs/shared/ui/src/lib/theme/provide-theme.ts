import {
  APP_INITIALIZER,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { ThemeStore } from '@silvervibe/stores/theme';

/** Ensures ThemeStore initializes early so `data-theme` is applied before paint. */
export function provideSilvervibeTheme(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const theme = inject(ThemeStore);
        return () => {
          void theme.mode();
        };
      },
    },
  ]);
}
