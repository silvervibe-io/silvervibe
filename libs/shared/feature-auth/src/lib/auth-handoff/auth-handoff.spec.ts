import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import { of } from 'rxjs';
import { AuthHandoff } from './auth-handoff';

@Component({
  selector: 'sv-handoff-target',
  template: '',
})
class HandoffTarget {}

describe('AuthHandoff', () => {
  let fixture: ComponentFixture<AuthHandoff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthHandoff],
      providers: [
        provideRouter([{ path: 'app', component: HandoffTarget }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) =>
                  key === 'token'
                    ? 'dev-handoff:uid'
                    : key === 'returnUrl'
                      ? '/app'
                      : null,
              },
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            signInWithCustomToken: async () => ({}),
          },
        },
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
                auth: {
                  handoff: {
                    working: 'Signing you in…',
                    missingToken: 'Missing token',
                    failed: 'Handoff failed',
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
    fixture = TestBed.createComponent(AuthHandoff);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('completes without error for dev handoff tokens', () => {
    expect(fixture.componentInstance.error()).toBeNull();
  });
});
