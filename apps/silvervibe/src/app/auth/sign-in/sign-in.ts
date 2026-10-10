import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';
import { Observable } from 'rxjs';

@Component({
  selector: 'sv-sign-in',
  imports: [ReactiveFormsModule, RouterLink, Shell],
  templateUrl: './sign-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly user = this.auth.user;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  signInEmail(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.run(this.auth.signIn(email, password));
  }

  signInGoogle(): void {
    this.run(this.auth.signInWithGoogle());
  }

  signInGithub(): void {
    this.run(this.auth.signInWithGithub());
  }

  signOut(): void {
    this.run(this.auth.signOut(), false);
  }

  private run(action: Observable<unknown>, navigateToAccount = true): void {
    this.error.set(null);
    this.busy.set(true);
    action.subscribe({
      next: () => {
        this.busy.set(false);
        if (navigateToAccount) {
          void this.router.navigateByUrl('/account');
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof Error ? err.message : 'Sign-in failed');
      },
    });
  }
}
