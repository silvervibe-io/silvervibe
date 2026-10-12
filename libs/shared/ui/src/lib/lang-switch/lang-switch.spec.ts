import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { LangSwitch } from './lang-switch';

describe('LangSwitch', () => {
  let fixture: ComponentFixture<LangSwitch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LangSwitch],
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
                common: {
                  language: {
                    label: 'Language',
                    en: 'English',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LangSwitch);
    await fixture.whenStable();
  });

  it('renders a language select', () => {
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select');
    expect(select).toBeTruthy();
  });
});
