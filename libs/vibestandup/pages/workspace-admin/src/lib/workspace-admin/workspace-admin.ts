import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  WorkspaceFacade,
  type LinearConnectionView,
  type LinearProjectView,
  type SlackConnectionView,
} from '@silvervibe/stores/workspace';

type CreateTeamModel = {
  name: string;
  slug: string;
};

@Component({
  selector: 'vs-workspace-admin',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './workspace-admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class WorkspaceAdmin implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly preview = inject(PreviewContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.workspaces.loading;
  readonly error = this.workspaces.error;
  readonly memberships = this.workspaces.memberships;
  readonly selected = computed(() => this.workspaces.selectedWorkspace());
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
  readonly tools = computed(() => this.selected()?.tools ?? []);
  readonly message = signal<string | null>(null);
  readonly slack = signal<SlackConnectionView | null>(null);
  readonly slackError = signal<string | null>(null);
  readonly slackConnecting = signal(false);
  readonly linear = signal<LinearConnectionView | null>(null);
  readonly linearProjects = signal<LinearProjectView[]>([]);
  readonly linearError = signal<string | null>(null);
  readonly linearConnecting = signal(false);

  readonly teamModel = signal<CreateTeamModel>({ name: '', slug: '' });
  readonly teamForm = form(this.teamModel, (schemaPath) => {
    required(schemaPath.name);
    required(schemaPath.slug);
  });

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.workspaces.loadMyWorkspaces();
    const ws = this.selected();
    if (ws && this.isAdmin()) {
      await Promise.all([this.refreshSlack(ws.id), this.refreshLinear(ws.id)]);
    }
    this.applyOAuthQueryResults();
  }

  private applyOAuthQueryResults(): void {
    const params = this.route.snapshot.queryParamMap;
    const slack = params.get('slack');
    const linear = params.get('linear');
    const clear: Record<string, null> = {};
    if (slack) {
      if (slack === 'connected') {
        this.message.set('standup.workspace.slackConnected');
      } else if (slack === 'error') {
        this.slackError.set(
          params.get('slackDetail') || 'Slack connect failed',
        );
      }
      clear['slack'] = null;
      clear['slackDetail'] = null;
    }
    if (linear) {
      if (linear === 'connected') {
        this.message.set('standup.workspace.linearConnected');
      } else if (linear === 'error') {
        this.linearError.set(
          params.get('linearDetail') || 'Linear connect failed',
        );
      }
      clear['linear'] = null;
      clear['linearDetail'] = null;
    }
    if (Object.keys(clear).length === 0) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clear,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.selectWorkspace(workspaceId);
    this.slack.set(null);
    this.slackError.set(null);
    this.linear.set(null);
    this.linearProjects.set([]);
    this.linearError.set(null);
    if (this.isAdmin()) {
      await Promise.all([
        this.refreshSlack(workspaceId),
        this.refreshLinear(workspaceId),
      ]);
    }
  }

  private async refreshSlack(workspaceId: string): Promise<void> {
    try {
      const conn = await this.workspaces.getSlackConnection(workspaceId);
      this.slack.set(conn);
    } catch (err: unknown) {
      this.slackError.set(
        err instanceof Error ? err.message : 'Failed to load Slack connection',
      );
    }
  }

  private async refreshLinear(workspaceId: string): Promise<void> {
    try {
      const conn = await this.workspaces.getLinearConnection(workspaceId);
      this.linear.set(conn);
      if (conn.configured) {
        try {
          const projects =
            await this.workspaces.listLinearProjects(workspaceId);
          this.linearProjects.set(projects);
        } catch (err: unknown) {
          this.linearError.set(
            err instanceof Error
              ? err.message
              : 'Failed to load Linear projects',
          );
        }
      } else {
        this.linearProjects.set([]);
      }
    } catch (err: unknown) {
      this.linearError.set(
        err instanceof Error ? err.message : 'Failed to load Linear connection',
      );
    }
  }

  async toggleTool(toolKey: string, enabled: boolean): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    await this.workspaces.setToolEntitlement(ws.id, toolKey, enabled);
    await this.workspaces.loadMyWorkspaces();
    this.workspaces.selectWorkspace(ws.id);
    this.message.set('standup.workspace.toolUpdated');
  }

  async connectSlack(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.slackError.set(null);
    this.slackConnecting.set(true);
    try {
      const { authorizeUrl } = await this.workspaces.startSlackOAuth(ws.id);
      window.location.assign(authorizeUrl);
    } catch (err: unknown) {
      this.slackConnecting.set(false);
      this.slackError.set(
        err instanceof Error ? err.message : 'Slack connect failed',
      );
    }
  }

  async disconnectSlack(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.slackError.set(null);
    try {
      const conn = await this.workspaces.disconnectSlack(ws.id);
      this.slack.set(conn);
      this.message.set('standup.workspace.slackDisconnected');
    } catch (err: unknown) {
      this.slackError.set(
        err instanceof Error ? err.message : 'Slack disconnect failed',
      );
    }
  }

  async connectLinear(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.linearError.set(null);
    this.linearConnecting.set(true);
    try {
      const { authorizeUrl } = await this.workspaces.startLinearOAuth(ws.id);
      window.location.assign(authorizeUrl);
    } catch (err: unknown) {
      this.linearConnecting.set(false);
      this.linearError.set(
        err instanceof Error ? err.message : 'Linear connect failed',
      );
    }
  }

  async selectLinearProject(projectId: string): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin() || !projectId.trim()) {
      return;
    }
    this.linearError.set(null);
    try {
      const conn = await this.workspaces.selectLinearProject(ws.id, {
        projectId: projectId.trim(),
      });
      this.linear.set(conn);
      this.message.set('standup.workspace.linearProjectSaved');
    } catch (err: unknown) {
      this.linearError.set(
        err instanceof Error ? err.message : 'Failed to save Linear project',
      );
    }
  }

  async disconnectLinear(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.linearError.set(null);
    try {
      const conn = await this.workspaces.disconnectLinear(ws.id);
      this.linear.set(conn);
      this.linearProjects.set([]);
      this.message.set('standup.workspace.linearDisconnected');
    } catch (err: unknown) {
      this.linearError.set(
        err instanceof Error ? err.message : 'Linear disconnect failed',
      );
    }
  }

  async createTeam(event: Event): Promise<void> {
    event.preventDefault();
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    await submit(this.teamForm, {
      action: async () => {
        const body = this.teamModel();
        await this.workspaces.createTeam(ws.id, body);
        this.teamModel.set({ name: '', slug: '' });
        this.message.set('standup.workspace.teamCreated');
        return undefined;
      },
    });
  }
}
