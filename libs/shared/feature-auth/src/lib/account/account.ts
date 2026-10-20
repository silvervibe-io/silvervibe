import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';
import { UserFacade } from '@silvervibe/stores/user';

@Component({
  selector: 'sv-account',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Account implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserFacade);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  readonly productTitle = input('Silver Vibe');
  readonly authPath = input('/auth');

  readonly user = this.auth.user;
  readonly me = this.users.profile;
  readonly loading = this.users.loading;
  readonly error = computed(() => {
    const err = this.users.error();
    if (!err) {
      return null;
    }
    return err || this.transloco.translate('auth.account.loadFailed');
  });

  ngOnInit(): void {
    void this.users.loadMe();
  }

  async signOut(): Promise<void> {
    this.users.clear();
    await this.auth.signOut();
    void this.router.navigateByUrl(this.authPath());
  }
}
