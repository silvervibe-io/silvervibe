import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { API_BASE_URL, AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';

export type MeResponse = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

@Component({
  selector: 'sv-account',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly transloco = inject(TranslocoService);

  readonly productTitle = input('Silver Vibe');
  readonly authPath = input('/auth');

  readonly user = this.auth.user;

  readonly profile = httpResource<MeResponse>(() => `${this.apiBaseUrl}/me`);

  readonly me = computed(() => this.profile.value() ?? null);
  readonly loading = computed(() => this.profile.isLoading());
  readonly error = computed(() => {
    const err = this.profile.error();
    if (!err) {
      return null;
    }
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return this.transloco.translate('auth.account.loadFailed');
  });

  async signOut(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl(this.authPath());
  }
}
