import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { of } from 'rxjs';
import { SignIn } from './sign-in';

describe('SignIn', () => {
  let fixture: ComponentFixture<SignIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        provideRouter([]),
        { provide: PREVIEW_SWITCHER_EMAILS, useValue: [] },
        {
          provide: PREVIEW_SWITCHER_USER_EMAIL,
          useValue: signal<string | null>(null),
        },
        {
          provide: AuthService,
          useValue: {
            user: () => null,
            signIn: () => Promise.resolve({ uid: 'u1' }),
            signInWithGoogle: () => Promise.resolve({ uid: 'u1' }),
            signInWithGithub: () => Promise.resolve({ uid: 'u1' }),
            signOut: () => Promise.resolve(),
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
                  signIn: {
                    title: 'Sign in',
                    blurb: { platform: 'Platform blurb' },
                    google: 'Continue with Google',
                    github: 'Continue with GitHub',
                    email: 'Email',
                    password: 'Password',
                    submitEmail: 'Sign in with email',
                    or: 'or',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SignIn);
    fixture.componentRef.setInput('productTitle', 'Test Product');
    await fixture.whenStable();
  });

  it('renders sign-in heading and providers', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Sign in');
    expect(compiled.textContent).toContain('Continue with Google');
    expect(compiled.textContent).toContain('Continue with GitHub');
    expect(compiled.querySelector('sv-icon[name="google"]')).toBeTruthy();
    expect(compiled.querySelector('sv-icon[name="github"]')).toBeTruthy();
  });

  it('shows the configured product title', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Product');
  });
});
