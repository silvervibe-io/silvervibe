import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { Terms } from './terms';

describe('Terms', () => {
  let fixture: ComponentFixture<Terms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Terms],
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
                landing: { footer: { privacy: 'Privacy' } },
                terms: {
                  crumb: 'Terms',
                  title: 'Terms of use',
                  updated: 'Last updated: 26 November 2026.',
                  acceptance: {
                    title: 'Acceptance',
                    body: 'By creating an account you agree.',
                  },
                  service: { title: 'The service', body: 'Workspace tools.' },
                  accounts: {
                    title: 'Accounts and workspaces',
                    body: 'Keep credentials secure.',
                  },
                  acceptable: {
                    title: 'Acceptable use',
                    body: 'Do not abuse the service.',
                  },
                  disclaimer: {
                    title: 'Disclaimer',
                    body: 'Provided without warranties.',
                  },
                  privacyLink: {
                    title: 'Privacy',
                    body: 'See the Privacy notice.',
                  },
                  contact: { title: 'Contact', body: 'Questions:' },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Terms);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the terms heading and contact', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Terms of use');
    expect(compiled.textContent).toContain('By creating an account');
    expect(compiled.textContent).toContain('info@silvervibe.io');
  });
});
