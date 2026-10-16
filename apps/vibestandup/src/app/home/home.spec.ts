import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
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
                  body: 'Share yesterday, today, and blockers when your team is ready.',
                  cta: { login: 'Log in', platform: 'SilverVibe' },
                  footer: {
                    legal: 'Vibe Standup is part of Silver Vibe™.',
                    github: 'Source on GitHub',
                  },
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

  it('renders the marketing hero with a login CTA', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector('p[aria-label="Vibe Standup"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('Vibe');
    expect(brand?.textContent).toContain('Standup');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Async standups without the meeting.',
    );
    expect(compiled.textContent).toContain('Log in');
    expect(compiled.querySelector('a[href="/auth"]')).toBeTruthy();
    expect(compiled.textContent).not.toContain('Save draft');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
