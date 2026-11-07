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
                  featuresTitle: 'A calmer way to work together',
                  featureAsyncTitle: 'Work across time zones',
                  featureAsyncBody:
                    'People share an update when their day starts.',
                  featureMeetingsTitle: 'Fewer status meetings',
                  featureMeetingsBody: 'The update is written once.',
                  featureToolTitle: 'VibeStandup comes first',
                  featureToolBody: 'A daily standup with a short summary.',
                  stepsTitle: 'How it works',
                  stepOneTitle: 'Sign in',
                  stepOneBody: 'Use the account you already have.',
                  stepTwoTitle: 'Open your workspace',
                  stepTwoBody: 'See the tools your team has turned on.',
                  stepThreeTitle: 'Post the standup',
                  stepThreeBody: 'Share yesterday, today, and what you need.',
                  closeTitle: "Start with today's standup",
                  closeBody: 'Sign in and open your workspace.',
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
    const brand = compiled.querySelector('[aria-label="SilverVibe"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('Silver');
    expect(brand?.textContent).toContain('Vibe');
    expect(brand?.textContent).toContain('™');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'A better vibe for async work.',
    );
    expect(compiled.textContent).toContain('Work across time zones');
    expect(compiled.textContent).toContain('Fewer status meetings');
    expect(compiled.textContent).toContain('VibeStandup comes first');
    expect(compiled.textContent).toContain('How it works');
    expect(compiled.querySelector('header a.btn-primary')).toBeTruthy();
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
