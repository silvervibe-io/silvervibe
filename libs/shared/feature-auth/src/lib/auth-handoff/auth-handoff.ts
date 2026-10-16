import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-auth-handoff',
  imports: [Shell, TranslocoPipe],
  templateUrl: './auth-handoff.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class AuthHandoff implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly busy = signal(true);

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    const returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/app';

    if (!token) {
      this.error.set('auth.handoff.missingToken');
      this.busy.set(false);
      void this.router.navigateByUrl('/auth');
      return;
    }

    if (token.startsWith('dev-handoff:')) {
      // Dev without Firebase Admin: continue as already-signed-in or to auth.
      this.busy.set(false);
      void this.router.navigateByUrl(returnUrl);
      return;
    }

    try {
      await this.auth.signInWithCustomToken(token);
      void this.router.navigateByUrl(returnUrl);
    } catch (err: unknown) {
      this.error.set(
        err instanceof Error ? err.message : 'auth.handoff.failed',
      );
      this.busy.set(false);
      void this.router.navigateByUrl('/auth');
    }
  }
}
