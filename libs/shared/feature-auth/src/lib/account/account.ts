import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
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
  imports: [RouterLink, Shell],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Account implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  readonly productTitle = input('Silver Vibe');
  readonly authPath = input('/auth');

  readonly user = this.auth.user;
  readonly me = signal<MeResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.http.get<MeResponse>(`${this.apiBaseUrl}/me`).subscribe({
      next: (me) => {
        this.me.set(me);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load /api/me';
        this.error.set(message);
      },
    });
  }

  signOut(): void {
    this.auth.signOut().subscribe({
      next: () => {
        void this.router.navigateByUrl(this.authPath());
      },
    });
  }
}
