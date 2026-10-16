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
                nav: {
                  about: 'About',
                  tools: 'Tools',
                  signIn: 'Sign in',
                },
                landing: {
                  badge: 'Personal project · In development',
                  headline: 'A better vibe for async work.',
                  body: 'Exploring calmer ways.',
                  footer: {
                    legal:
                      'Silver Vibe™ is a personal open-source project (MIT).',
                    github: 'Source on GitHub',
                    privacy: 'Privacy',
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

  it('renders the SilverVibe home headline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector('p[aria-label="SilverVibe"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('Silver');
    expect(brand?.textContent).toContain('Vibe');
    expect(brand?.textContent).toContain('™');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'A better vibe for async work.',
    );
    expect(compiled.textContent).toContain('personal open-source');
    expect(compiled.textContent).toContain('Privacy');
    expect(compiled.textContent).toContain('About');
    expect(compiled.textContent).toContain('Sign in');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
