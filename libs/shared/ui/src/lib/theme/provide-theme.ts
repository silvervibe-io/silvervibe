import {
  EnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { ThemeStore } from '@silvervibe/stores/theme';

/** Ensures ThemeStore initializes early so `data-theme` is applied before paint. */
export function provideSilvervibeTheme(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const theme = inject(ThemeStore);
    void theme.mode();
  });
}
