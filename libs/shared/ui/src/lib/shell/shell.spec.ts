import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { THEME_STORAGE_KEY, ThemeService } from '../theme/theme.service';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        ThemeService,
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
                common: {
                  language: {
                    label: 'Language',
                    en: 'English',
                  },
                },
                shell: {
                  theme: {
                    toDark: 'Switch to dark theme',
                    toLight: 'Switch to light theme',
                    dark: 'Dark',
                    light: 'Light',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    const theme = TestBed.inject(ThemeService);
    theme.init();
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
  });

  it('renders the title and theme toggle', () => {
    fixture.componentRef.setInput('title', 'Silver Vibe');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Silver Vibe');
    expect(compiled.textContent).toContain('Dark');
  });

  it('toggles theme when the button is clicked', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[aria-label]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.mode()).toBe('dark');
    expect(fixture.nativeElement.textContent).toContain('Light');
  });
});
