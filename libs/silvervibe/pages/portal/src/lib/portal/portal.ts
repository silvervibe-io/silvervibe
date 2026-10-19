import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, STANDUP_APP_ORIGIN } from '@silvervibe/shared/auth';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import { UserFacade } from '@silvervibe/stores/user';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

@Component({
  selector: 'sv-portal',
  imports: [Shell, TranslocoPipe],
  templateUrl: './portal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Portal implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly users = inject(UserFacade);
  private readonly preview = inject(PreviewContextStore);
  private readonly auth = inject(AuthService);
  private readonly standupOrigin =
    inject(STANDUP_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4201';

  readonly loading = this.workspaces.loading;
  readonly error = this.workspaces.error;
  readonly memberships = this.workspaces.memberships;
  readonly selected = computed(() => this.workspaces.selectedWorkspace());
  readonly enabledTools = computed(() => this.workspaces.enabledTools());
  readonly isAdmin = computed(() => this.workspaces.isWorkspaceAdmin());
  readonly effectiveRole = computed(() =>
    this.workspaces.effectiveWorkspaceRole(),
  );
  readonly previewActive = this.preview.isActive;
  readonly planHint = computed(() => {
    if (!this.preview.isActive()) {
      return null;
    }
    const limits = getVibestandupLimits(this.preview.planKey());
    return {
      planKey: this.preview.planKey(),
      maxTeams: limits.maxTeams,
      maxMembersPerTeam: limits.maxMembersPerTeam,
    };
  });
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
      const { customToken } = await this.users.createCustomToken();
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
