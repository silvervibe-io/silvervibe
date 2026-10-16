import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ToolsVibestandup } from './tools-vibestandup';

describe('ToolsVibestandup', () => {
  let fixture: ComponentFixture<ToolsVibestandup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolsVibestandup],
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
                nav: {
                  home: 'Home',
                  about: 'About',
                  tools: 'Tools',
                  signIn: 'Sign in',
                },
                tools: {
                  vibestandup: {
                    eyebrow: 'Tool',
                    title: 'VibeStandup',
                    body: 'Async standups.',
                    ctaSignIn: 'Sign in',
                    ctaOpen: 'Open app',
                  },
                },
                shell: {
                  theme: { toDark: 'Dark', toLight: 'Light' },
                },
                common: { language: { label: 'Language', en: 'English' } },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ToolsVibestandup);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the VibeStandup tool title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('VibeStandup');
  });
});
