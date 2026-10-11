import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'silvervibe.theme';
export const THEME_LIGHT = 'silvervibe';
export const THEME_DARK = 'silvervibe-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>('light');
  readonly mode = this.modeSignal.asReadonly();

  /** Apply stored preference, else system preference. Call once at app start. */
  init(): void {
    const stored = this.readStored();
    if (stored) {
      this.apply(stored);
      return;
    }
    const prefersDark =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    this.apply(prefersDark ? 'dark' : 'light', false);
  }

  setMode(mode: ThemeMode): void {
    this.apply(mode, true);
  }

  toggle(): void {
    this.setMode(this.modeSignal() === 'light' ? 'dark' : 'light');
  }

  themeName(mode: ThemeMode = this.modeSignal()): string {
    return mode === 'dark' ? THEME_DARK : THEME_LIGHT;
  }

  private apply(mode: ThemeMode, persist = true): void {
    this.modeSignal.set(mode);
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', this.themeName(mode));
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }

  private readStored(): ThemeMode | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }
}
