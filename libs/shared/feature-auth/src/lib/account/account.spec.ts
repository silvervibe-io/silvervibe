import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { API_BASE_URL, AuthService } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { UserStore } from '@silvervibe/stores/user';
import { of } from 'rxjs';
import { Account } from './account';

describe('Account', () => {
  let fixture: ComponentFixture<Account>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: PREVIEW_SWITCHER_EMAILS, useValue: [] },
        {
          provide: PREVIEW_SWITCHER_USER_EMAIL,
          useValue: signal<string | null>(null),
        },
        {
          provide: AuthService,
          useValue: {
            user: () => ({ uid: 'u1', email: 'u1@example.com' }),
            signOut: () => Promise.resolve(),
          },
        },
        UserStore,
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
                  preview: {
                    badge: 'Preview',
                    role: 'Role',
                    plan: 'Plan',
                    limits: '{{plan}}',
                  },
                },
                auth: {
                  account: {
                    title: 'Account',
                    intro: 'Calls GET /api/me',
                    loading: 'Loading…',
                    neonId: 'Neon id',
                    firebaseUid: 'Firebase uid',
                    email: 'Email',
                    displayName: 'Display name',
                    empty: '—',
                    backToSignIn: 'Back to sign in',
                    signOut: 'Sign out',
                    loadFailed: 'Failed to load /api/me',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Account);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('loads /api/me profile via UserStore', async () => {
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'cuid1',
      firebaseUid: 'u1',
      email: 'u1@example.com',
      displayName: 'User',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('cuid1');
    expect(fixture.nativeElement.textContent).toContain('u1@example.com');
  });
});
