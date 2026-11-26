import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { Privacy } from './privacy';

describe('Privacy', () => {
  let fixture: ComponentFixture<Privacy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacy],
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
                landing: { footer: { terms: 'Terms' } },
                privacy: {
                  crumb: 'Privacy',
                  title: 'Privacy notice',
                  updated: 'Last updated: 26 November 2026.',
                  controller: {
                    title: 'Who is responsible',
                    body: 'The project operator.',
                  },
                  collect: {
                    title: 'What we collect',
                    intro: 'We may process:',
                    account: 'Firebase Authentication identifiers.',
                    workspace: 'Workspace membership.',
                    standup: 'Standup entries.',
                    products: 'Other product content.',
                    invites: 'Invites.',
                    oauth: 'OAuth tokens.',
                    technical: 'Technical logs.',
                  },
                  use: { title: 'How we use it', body: 'Operate the product.' },
                  processors: {
                    title: 'Processors and recipients',
                    intro: 'We use:',
                    firebase: 'Google Firebase Auth.',
                    neon: 'Neon Postgres.',
                    cloudflare: 'Cloudflare.',
                    cloudrun: 'Cloud Run.',
                    addons: 'Connected add-ons.',
                    gemini: 'Google Gemini when enabled.',
                  },
                  transfers: {
                    title: 'International transfers',
                    body: 'Some processors are in the United States.',
                  },
                  ai: {
                    title: 'Optional AI polish (Gemini)',
                    body: 'AI polish is off unless enabled.',
                  },
                  retention: {
                    title: 'Retention and your rights',
                    body: 'Account data is kept.',
                  },
                  rightsExtra: {
                    body: 'You may contact your supervisory authority.',
                  },
                  changes: {
                    title: 'Changes',
                    body: 'We update the date; continued use alone is not acceptance.',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Privacy);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the privacy notice with processors and Gemini', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Privacy notice',
    );
    expect(compiled.textContent).toContain('Firebase Authentication');
    expect(compiled.textContent).toContain('Neon Postgres');
    expect(compiled.textContent).toContain('Google Gemini');
    expect(compiled.textContent).toContain('info@silvervibe.io');
    expect(compiled.textContent).toContain(
      'continued use alone is not acceptance',
    );
  });
});
