import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { ThemeStore } from '@silvervibe/stores/theme';
import { of } from 'rxjs';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  let fixture: ComponentFixture<ThemeToggle>;
  let themeStore: ThemeStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [
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
                shell: {
                  theme: {
                    toDark: 'Switch to dark theme',
                    toLight: 'Switch to light theme',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggle);
    themeStore = TestBed.inject(ThemeStore);
    themeStore.setMode('light');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the daisyUI swap control with shared icons', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.swap.swap-rotate')).toBeTruthy();
    expect(
      root.querySelector('[aria-label="Switch to dark theme"]'),
    ).toBeTruthy();
    expect(root.querySelector('sv-icon.swap-on')).toBeTruthy();
    expect(root.querySelector('sv-icon.swap-off')).toBeTruthy();
  });

  it('toggles ThemeStore between light and dark', () => {
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement;

    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(themeStore.mode()).toBe('dark');

    input.checked = false;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(themeStore.mode()).toBe('light');
  });
});
