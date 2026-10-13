import type { LangDefinition } from '@jsverse/transloco';

export const LANG_STORAGE_KEY = 'sv.lang';

export const AVAILABLE_LANGS: LangDefinition[] = [
  { id: 'en', label: 'English' },
  { id: 'nl', label: 'Nederlands' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'el', label: 'Ελληνικά' },
  { id: 'es', label: 'Español' },
  { id: 'pt', label: 'Português' },
  { id: 'it', label: 'Italiano' },
  { id: 'pl', label: 'Polski' },
];

export const I18N_SCOPES = [
  'common',
  'shell',
  'auth',
  'landing',
  'privacy',
  'standup',
] as const;

export type SilvervibeLang = (typeof AVAILABLE_LANGS)[number]['id'];

export function isSilvervibeLang(
  value: string | null | undefined,
): value is SilvervibeLang {
  return !!value && AVAILABLE_LANGS.some((lang) => lang.id === value);
}

export function readStoredLang(): SilvervibeLang {
  if (typeof localStorage === 'undefined') {
    return 'en';
  }
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return isSilvervibeLang(stored) ? stored : 'en';
}

export function persistLang(lang: string): void {
  if (typeof localStorage === 'undefined' || !isSilvervibeLang(lang)) {
    return;
  }
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}
