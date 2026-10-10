import {
  EnvironmentProviders,
  APP_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { ThemeService } from './theme.service';

export function provideSilvervibeTheme(): EnvironmentProviders {
  return makeEnvironmentProviders([
    ThemeService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const theme = inject(ThemeService);
        return () => theme.init();
      },
    },
  ]);
}
