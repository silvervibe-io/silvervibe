import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  API_BASE_URL,
  AuthService,
  STANDUP_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';
import { WorkspaceStore } from '@silvervibe/stores/workspace';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'sv-portal',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './portal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Portal implements OnInit {
  private readonly workspaces = inject(WorkspaceStore);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly standupOrigin =
    inject(STANDUP_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4201';

  readonly loading = this.workspaces.loading;
  readonly error = this.workspaces.error;
  readonly memberships = this.workspaces.memberships;
  readonly selected = computed(() => this.workspaces.selectedWorkspace());
  readonly enabledTools = computed(() => this.workspaces.enabledTools());
  readonly isAdmin = computed(() => this.workspaces.isWorkspaceAdmin());
  readonly openingTool = signal(false);

  ngOnInit(): void {
    void this.workspaces.loadMyWorkspaces();
  }

  selectWorkspace(workspaceId: string): void {
    this.workspaces.selectWorkspace(workspaceId);
  }

  async openVibeStandup(): Promise<void> {
    this.openingTool.set(true);
    try {
      const { customToken } = await firstValueFrom(
        this.http.post<{ customToken: string }>(
          `${this.apiBase}/auth/custom-token`,
          {},
        ),
      );
      const url = new URL('/auth/handoff', this.standupOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', '/app');
      window.location.assign(url.toString());
    } catch {
      window.location.assign(`${this.standupOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
