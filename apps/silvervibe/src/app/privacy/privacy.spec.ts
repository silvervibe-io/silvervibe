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
                privacy: {
                  crumb: 'Privacy',
                  title: 'Privacy policy',
                  updated: 'Last updated: 10 October 2026.',
                  collect: {
                    title: 'What we collect',
                    body: 'When you sign in via Firebase Authentication.',
                  },
                  use: { title: 'How we use it', body: 'Operate sign-in.' },
                  processors: {
                    title: 'Processors',
                    body: 'Google Firebase Auth.',
                  },
                  retention: {
                    title: 'Retention & rights',
                    body: 'Account data is kept.',
                  },
                  changes: { title: 'Changes', body: 'We may update.' },
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

  it('renders the privacy policy heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Privacy policy',
    );
    expect(compiled.textContent).toContain('Firebase Authentication');
    expect(compiled.textContent).toContain('info@silvervibe.io');
  });
});
