import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@silvervibe/shared/auth';
import { of } from 'rxjs';
import { SignIn } from './sign-in';

describe('SignIn', () => {
  let fixture: ComponentFixture<SignIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: () => null,
            signIn: () => of({ uid: 'u1' }),
            signInWithGoogle: () => of({ uid: 'u1' }),
            signInWithGithub: () => of({ uid: 'u1' }),
            signOut: () => of(undefined),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SignIn);
    await fixture.whenStable();
  });

  it('renders sign-in heading and providers', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Sign in');
    expect(compiled.textContent).toContain('Continue with Google');
    expect(compiled.textContent).toContain('Continue with GitHub');
  });
});
