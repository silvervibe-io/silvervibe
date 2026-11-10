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
                  home: {
                    featuresTitle: 'A standup people can follow',
                    featureClockTitle: 'Post on your own clock',
                    featureClockBody:
                      'The reminder arrives at the start of your work day.',
                    featureHelpTitle: 'Needs help comes first',
                    featureHelpBody: 'The summary leads with who is stuck.',
                    featureDigestTitle: 'One summary in chat',
                    featureDigestBody: 'The daily summary is posted in Slack.',
                    stepsTitle: 'How a day works',
                    stepOneTitle: 'Open your team',
                    stepOneBody: 'Sign in and choose the team.',
                    stepTwoTitle: 'Write three short lines',
                    stepTwoBody:
                      'Yesterday, today, and anything you need help with.',
                    stepThreeTitle: 'Read the summary',
                    stepThreeBody: 'Needs help stays open.',
                    closeTitle: 'Post when your day starts',
                    closeBody: "Sign in and write today's standup.",
                  },
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
    const brand = compiled.querySelector('[aria-label="Vibe Standup"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('Vibe');
    expect(brand?.textContent).toContain('Standup');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Async standups without the meeting.',
    );
    expect(compiled.textContent).toContain('Log in');
    expect(compiled.textContent).toContain('Post on your own clock');
    expect(compiled.textContent).toContain('Needs help comes first');
    expect(compiled.textContent).toContain('One summary in chat');
    expect(compiled.textContent).toContain('How a day works');
    expect(compiled.querySelector('a[href="/auth"]')).toBeTruthy();
    expect(compiled.textContent).not.toContain('Save draft');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
