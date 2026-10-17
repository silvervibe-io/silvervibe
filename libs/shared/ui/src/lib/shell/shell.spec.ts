import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { THEME_STORAGE_KEY, ThemeStore } from '@silvervibe/stores/theme';
import { of } from 'rxjs';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let themeStore: ThemeStore;

  beforeEach(async () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: PREVIEW_SWITCHER_EMAILS, useValue: [] },
        {
          provide: PREVIEW_SWITCHER_USER_EMAIL,
          useValue: signal<string | null>(null),
        },
        ...provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: class {
            getTranslation() {
              return of({
                common: {
                  language: {
                    label: 'Language',
                    en: 'English',
                  },
                },
                shell: {
                  theme: {
                    toDark: 'Switch to dark theme',
                    toLight: 'Switch to light theme',
                    dark: 'Dark',
                    light: 'Light',
                  },
                  preview: {
                    badge: 'Preview',
                    role: 'Role',
                    plan: 'Plan',
                    limits: '{{plan}}: {{teams}} / {{members}}',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    themeStore = TestBed.inject(ThemeStore);
    themeStore.setMode('light');
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
  });

  it('renders the title and theme toggle', () => {
    fixture.componentRef.setInput('title', 'Silver Vibe');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Silver Vibe');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('toggles theme when the swap input changes', () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'sv-theme-toggle input',
    ) as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(themeStore.mode()).toBe('dark');
  });
});
