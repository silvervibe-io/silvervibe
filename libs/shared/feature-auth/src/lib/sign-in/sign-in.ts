import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';
import { Observable } from 'rxjs';

@Component({
  selector: 'sv-sign-in',
  imports: [ReactiveFormsModule, RouterLink, Shell, TranslocoPipe],
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
  private readonly transloco = inject(TranslocoService);

  /** Product name shown in the shell (bind via route `data` + input binding). */
  readonly productTitle = input('Silver Vibe');
  /** Translation key for the blurb under the heading. */
  readonly blurbKey = input('auth.signIn.blurb.platform');
  readonly accountPath = input('/account');

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
          void this.router.navigateByUrl(this.accountPath());
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(
          err instanceof Error
            ? err.message
            : this.transloco.translate('auth.signIn.failed'),
        );
      },
    });
  }
}
