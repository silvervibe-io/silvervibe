import { TestBed } from '@angular/core/testing';
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  ThemeStore,
} from './theme.store';

describe('ThemeStore', () => {
  let store: ThemeStore;

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
    store = TestBed.inject(ThemeStore);
    store.setMode('light');
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light and toggles to dark', () => {
    expect(store.mode()).toBe('light');
    store.toggle();
    expect(store.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      THEME_DARK,
    );
  });

  it('sets mode explicitly and persists', () => {
    store.setMode('dark');
    expect(store.mode()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(store.themeName()).toBe(THEME_DARK);

    store.setMode('light');
    expect(store.themeName()).toBe(THEME_LIGHT);
  });
});
