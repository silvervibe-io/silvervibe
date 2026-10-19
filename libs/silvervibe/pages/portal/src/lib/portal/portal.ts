import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, STANDUP_APP_ORIGIN } from '@silvervibe/shared/auth';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import { UserFacade } from '@silvervibe/stores/user';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type CreateWorkspaceModel = {
  name: string;
  slug: string;
};

@Component({
  selector: 'sv-portal',
  imports: [FormField, Shell, TranslocoPipe],
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
  readonly createMessage = signal<string | null>(null);
  readonly createError = signal<string | null>(null);

  readonly workspaceModel = signal<CreateWorkspaceModel>({
    name: '',
    slug: '',
  });
  readonly workspaceForm = form(this.workspaceModel, (schemaPath) => {
    required(schemaPath.name);
    required(schemaPath.slug);
  });

  ngOnInit(): void {
    void this.workspaces.loadMyWorkspaces();
  }

  selectWorkspace(workspaceId: string): void {
    this.workspaces.selectWorkspace(workspaceId);
  }

  async createWorkspace(event: Event): Promise<void> {
    event.preventDefault();
    this.createMessage.set(null);
    this.createError.set(null);
    await submit(this.workspaceForm, {
      action: async () => {
        try {
          const body = this.workspaceModel();
          await this.workspaces.createWorkspace(body);
          this.workspaceModel.set({ name: '', slug: '' });
          this.createMessage.set('portal.createSuccess');
        } catch (err: unknown) {
          this.createError.set(
            err instanceof Error ? err.message : 'Failed to create workspace',
          );
        }
        return undefined;
      },
    });
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
