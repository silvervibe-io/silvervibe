import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ThemeStore } from '@silvervibe/stores/theme';
import { of } from 'rxjs';
import { Landing } from './landing';

describe('Landing', () => {
  let fixture: ComponentFixture<Landing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
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
    fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the SilverVibe landing headline', () => {
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
    expect(compiled.textContent).not.toContain('VibeStandup');
    expect(compiled.querySelector('sv-theme-toggle .swap')).toBeTruthy();
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
