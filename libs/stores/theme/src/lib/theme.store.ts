import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'silvervibe.theme';
export const THEME_LIGHT = 'silvervibe';
export const THEME_DARK = 'silvervibe-dark';

function readStoredTheme(): ThemeMode | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

function resolveInitialMode(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  ) {
    return 'dark';
  }
  return 'light';
}

function toThemeAttr(mode: ThemeMode): string {
  return mode === 'dark' ? THEME_DARK : THEME_LIGHT;
}

function applyDomTheme(mode: ThemeMode, persist: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', toThemeAttr(mode));
  }
  if (persist && typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState({ mode: 'light' as ThemeMode }),
  withMethods((store) => ({
    setMode(mode: ThemeMode): void {
      patchState(store, { mode });
      applyDomTheme(mode, true);
    },
    toggle(): void {
      const mode: ThemeMode = store.mode() === 'dark' ? 'light' : 'dark';
      patchState(store, { mode });
      applyDomTheme(mode, true);
    },
    themeName(mode: ThemeMode = store.mode()): string {
      return toThemeAttr(mode);
    },
  })),
  withHooks({
    onInit(store) {
      const mode = resolveInitialMode();
      const hadStored = readStoredTheme() !== null;
      patchState(store, { mode });
      applyDomTheme(mode, hadStored);
    },
  }),
);

export type ThemeStore = InstanceType<typeof ThemeStore>;
