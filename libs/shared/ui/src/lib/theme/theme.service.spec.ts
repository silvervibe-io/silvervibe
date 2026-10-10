import { TestBed } from '@angular/core/testing';
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  ThemeService,
} from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
  });

  it('applies light theme by default when no preference is stored', () => {
    const service = TestBed.inject(ThemeService);
    service.init();
    expect(service.mode()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      THEME_LIGHT,
    );
  });

  it('toggles between light and dark and persists', () => {
    const service = TestBed.inject(ThemeService);
    service.init();
    service.toggle();
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      THEME_DARK,
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('restores stored dark preference on init', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    service.init();
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      THEME_DARK,
    );
  });
});
