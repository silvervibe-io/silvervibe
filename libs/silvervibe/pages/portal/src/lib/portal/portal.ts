import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AuthService,
  FEEDBACK_APP_ORIGIN,
  MEETING_APP_ORIGIN,
  POLL_APP_ORIGIN,
  RETRO_APP_ORIGIN,
  STANDUP_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import {
  getVibestandupLimits,
  TOOL_KEYS,
  type ToolKey,
} from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import { UserFacade } from '@silvervibe/stores/user';
import {
  resolvePortalEntry,
  vibefeedbackReturnUrl,
  vibemeetingReturnUrl,
  vibepollReturnUrl,
  viberetroReturnUrl,
  vibestandupReturnUrl,
  WorkspaceFacade,
} from '@silvervibe/stores/workspace';

type CreateWorkspaceModel = {
  name: string;
  slug: string;
};

const PRODUCT_TOOL_KEYS = [
  TOOL_KEYS.vibestandup,
  TOOL_KEYS.vibepoll,
  TOOL_KEYS.viberetro,
  TOOL_KEYS.vibefeedback,
  TOOL_KEYS.vibemeeting,
] as const;

/** URL-safe slug from a workspace display name. */
export function slugifyWorkspaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'workspace';
}

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly standupOrigin =
    inject(STANDUP_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4201';
  private readonly pollOrigin =
    inject(POLL_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4202';
  private readonly retroOrigin =
    inject(RETRO_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4203';
  private readonly feedbackOrigin =
    inject(FEEDBACK_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4204';
  private readonly meetingOrigin =
    inject(MEETING_APP_ORIGIN, { optional: true }) ?? 'http://localhost:4205';

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
  /** Product tools for admins to enable/disable on the hub. */
  readonly manageTools = computed(() => {
    const existing = this.selected()?.tools ?? [];
    const byKey = new Map(existing.map((tool) => [tool.toolKey, tool]));
    return PRODUCT_TOOL_KEYS.map((toolKey) => {
      const current = byKey.get(toolKey);
      return current ?? { toolKey, enabled: false };
    });
  });
  readonly openingTool = signal(false);
  readonly togglingTool = signal<string | null>(null);
  readonly createMessage = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly showSlug = signal(false);
  readonly slugManual = signal(false);

  readonly workspaceModel = signal<CreateWorkspaceModel>({
    name: '',
    slug: '',
  });
  readonly workspaceForm = form(this.workspaceModel, (schemaPath) => {
    required(schemaPath.name);
    required(schemaPath.slug);
  });

  constructor() {
    effect(() => {
      const name = this.workspaceModel().name;
      if (this.slugManual()) {
        return;
      }
      const next = slugifyWorkspaceName(name);
      if (this.workspaceModel().slug !== next) {
        this.workspaceModel.update((model) => ({ ...model, slug: next }));
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const hadEnter = this.route.snapshot.queryParamMap.get('enter') === '1';
    await this.workspaces.loadMyWorkspaces();
    const decision = resolvePortalEntry(this.workspaces.memberships());
    if (decision.kind === 'product') {
      await this.openProduct(decision.toolKey, decision.workspaceId);
      return;
    }
    if (hadEnter) {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { enter: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  selectWorkspace(workspaceId: string): void {
    this.workspaces.selectWorkspace(workspaceId);
  }

  markSlugManual(): void {
    this.slugManual.set(true);
    this.showSlug.set(true);
  }

  async createWorkspace(event: Event): Promise<void> {
    event.preventDefault();
    this.createMessage.set(null);
    this.createError.set(null);
    await submit(this.workspaceForm, {
      action: async () => {
        try {
          const body = this.workspaceModel();
          await this.workspaces.createWorkspace({
            name: body.name.trim(),
            slug: (body.slug || slugifyWorkspaceName(body.name)).trim(),
          });
          this.workspaceModel.set({ name: '', slug: '' });
          this.slugManual.set(false);
          this.showSlug.set(false);
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

  async toggleTool(toolKey: string, enabled: boolean): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.togglingTool.set(toolKey);
    try {
      await this.workspaces.setToolEntitlement(ws.id, toolKey, enabled);
      await this.workspaces.loadMyWorkspaces();
      this.workspaces.selectWorkspace(ws.id);
    } finally {
      this.togglingTool.set(null);
    }
  }

  async openProduct(
    toolKey: ToolKey | string,
    workspaceId?: string,
  ): Promise<void> {
    switch (toolKey) {
      case TOOL_KEYS.vibestandup:
        await this.openVibeStandup(workspaceId);
        return;
      case TOOL_KEYS.vibepoll:
        await this.openVibePoll(workspaceId);
        return;
      case TOOL_KEYS.viberetro:
        await this.openVibeRetro(workspaceId);
        return;
      case TOOL_KEYS.vibefeedback:
        await this.openVibeFeedback(workspaceId);
        return;
      case TOOL_KEYS.vibemeeting:
        await this.openVibeMeeting(workspaceId);
        return;
      default:
        return;
    }
  }

  async openVibeStandup(workspaceId?: string): Promise<void> {
    const id = workspaceId ?? this.selected()?.id;
    this.openingTool.set(true);
    try {
      const { customToken } = await this.users.createCustomToken();
      const url = new URL('/auth/handoff', this.standupOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', vibestandupReturnUrl(id));
      this.assignLocation(url.toString());
    } catch {
      this.assignLocation(`${this.standupOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  async openVibePoll(workspaceId?: string): Promise<void> {
    const id = workspaceId ?? this.selected()?.id;
    this.openingTool.set(true);
    try {
      const { customToken } = await this.users.createCustomToken();
      const url = new URL('/auth/handoff', this.pollOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', vibepollReturnUrl(id));
      this.assignLocation(url.toString());
    } catch {
      this.assignLocation(`${this.pollOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  async openVibeRetro(workspaceId?: string): Promise<void> {
    const id = workspaceId ?? this.selected()?.id;
    this.openingTool.set(true);
    try {
      const { customToken } = await this.users.createCustomToken();
      const url = new URL('/auth/handoff', this.retroOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', viberetroReturnUrl(id));
      this.assignLocation(url.toString());
    } catch {
      this.assignLocation(`${this.retroOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  async openVibeFeedback(workspaceId?: string): Promise<void> {
    const id = workspaceId ?? this.selected()?.id;
    this.openingTool.set(true);
    try {
      const { customToken } = await this.users.createCustomToken();
      const url = new URL('/auth/handoff', this.feedbackOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', vibefeedbackReturnUrl(id));
      this.assignLocation(url.toString());
    } catch {
      this.assignLocation(`${this.feedbackOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  async openVibeMeeting(workspaceId?: string): Promise<void> {
    const id = workspaceId ?? this.selected()?.id;
    this.openingTool.set(true);
    try {
      const { customToken } = await this.users.createCustomToken();
      const url = new URL('/auth/handoff', this.meetingOrigin);
      url.searchParams.set('token', customToken);
      url.searchParams.set('returnUrl', vibemeetingReturnUrl(id));
      this.assignLocation(url.toString());
    } catch {
      this.assignLocation(`${this.meetingOrigin}/auth`);
    } finally {
      this.openingTool.set(false);
    }
  }

  assignLocation(url: string): void {
    window.location.assign(url);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
