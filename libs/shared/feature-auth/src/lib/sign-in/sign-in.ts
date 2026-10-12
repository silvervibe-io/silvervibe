import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';

type SignInModel = {
  email: string;
  password: string;
};

@Component({
  selector: 'sv-sign-in',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './sign-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Product name shown in the shell (bind via route `data` + input binding). */
  readonly productTitle = input('Silver Vibe');
  /** Translation key for the blurb under the heading. */
  readonly blurbKey = input('auth.signIn.blurb.platform');
  readonly accountPath = input('/account');

  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly user = this.auth.user;

  readonly loginModel = signal<SignInModel>({
    email: '',
    password: '',
  });

  readonly loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email);
    email(schemaPath.email);
    required(schemaPath.password);
    minLength(schemaPath.password, 6);
  });

  async signInEmail(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.loginForm, {
      action: async () => {
        const { email: address, password } = this.loginModel();
        await this.run(() => this.auth.signIn(address, password));
        return undefined;
      },
    });
  }

  signInGoogle(): void {
    void this.run(() => this.auth.signInWithGoogle());
  }

  signInGithub(): void {
    void this.run(() => this.auth.signInWithGithub());
  }

  signOut(): void {
    void this.run(() => this.auth.signOut(), false);
  }

  private async run(
    action: () => Promise<unknown>,
    navigateToAccount = true,
  ): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await action();
      if (navigateToAccount) {
        void this.router.navigateByUrl(this.accountPath());
      }
    } catch (err: unknown) {
      this.error.set(
        err instanceof Error
          ? err.message
          : this.transloco.translate('auth.signIn.failed'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
