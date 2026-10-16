import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideMockStore } from '@ngrx/store/testing';
import { ThemeStore } from '@silvervibe/stores/theme';
import { of } from 'rxjs';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            standup: { yesterday: '', today: '', blockers: '' },
          },
        }),
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
                common: { language: { label: 'Language', en: 'English' } },
                shell: {
                  theme: {
                    toDark: 'Switch to dark theme',
                    toLight: 'Switch to light theme',
                  },
                },
                standup: {
                  badge: 'Personal project · In development',
                  headline: 'Async standups without the meeting.',
                  body: 'Capture yesterday, today, and blockers.',
                  cta: { draft: 'Start a draft', platform: 'SilverVibe' },
                  footer: {
                    legal: 'Vibe Standup is part of Silver Vibe™.',
                    github: 'Source on GitHub',
                  },
                  title: "Today's draft",
                  subtitle: 'Yesterday, today, and blockers.',
                  yesterday: 'Yesterday',
                  today: 'Today',
                  blockers: 'Blockers',
                  save: 'Save draft',
                  saved: 'Draft saved',
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    TestBed.inject(ThemeStore).setMode('light');
    fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the marketing hero and draft form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector('p[aria-label="Vibe Standup"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('Vibe');
    expect(brand?.textContent).toContain('Standup');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Async standups without the meeting.',
    );
    expect(compiled.textContent).toContain('Start a draft');
    expect(compiled.textContent).toContain('Yesterday');
    expect(compiled.textContent).toContain('Save draft');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
