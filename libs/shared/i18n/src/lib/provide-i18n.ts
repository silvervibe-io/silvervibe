import { isDevMode, type EnvironmentProviders } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { AVAILABLE_LANGS, readStoredLang } from './langs';
import { SilvervibeTranslocoLoader } from './transloco-loader';

export function provideSilvervibeI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: AVAILABLE_LANGS,
      defaultLang: readStoredLang(),
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: SilvervibeTranslocoLoader,
  });
}
