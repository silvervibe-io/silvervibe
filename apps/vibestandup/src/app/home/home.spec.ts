import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            standup: { yesterday: '', today: '', blockers: '' },
          },
        }),
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
                    toDark: 'dark',
                    toLight: 'light',
                    dark: 'Dark',
                    light: 'Light',
                  },
                },
                standup: {
                  title: 'Vibe Standup',
                  subtitle: 'Capture yesterday, today, and blockers.',
                  yesterday: 'Yesterday',
                  today: 'Today',
                  blockers: 'Blockers',
                  save: 'Save draft',
                  saved: 'Draft saved',
                  links: { platform: 'SilverVibe' },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the standup draft form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Vibe Standup');
    expect(compiled.textContent).toContain('Yesterday');
    expect(compiled.textContent).toContain('Save draft');
  });
});
