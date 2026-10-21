import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  WorkspaceFacade,
  type SlackConnectionView,
} from '@silvervibe/stores/workspace';

type CreateTeamModel = {
  name: string;
  slug: string;
};

type SlackModel = {
  incomingWebhookUrl: string;
  channelLabel: string;
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

  readonly teamModel = signal<CreateTeamModel>({ name: '', slug: '' });
  readonly teamForm = form(this.teamModel, (schemaPath) => {
    required(schemaPath.name);
    required(schemaPath.slug);
  });

  readonly slackModel = signal<SlackModel>({
    incomingWebhookUrl: '',
    channelLabel: '',
  });
  readonly slackForm = form(this.slackModel, (schemaPath) => {
    required(schemaPath.incomingWebhookUrl);
  });

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.workspaces.loadMyWorkspaces();
    const ws = this.selected();
    if (ws && this.isAdmin()) {
      await this.refreshSlack(ws.id);
    }
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.selectWorkspace(workspaceId);
    this.slack.set(null);
    this.slackError.set(null);
    if (this.isAdmin()) {
      await this.refreshSlack(workspaceId);
    }
  }

  private async refreshSlack(workspaceId: string): Promise<void> {
    try {
      const conn = await this.workspaces.getSlackConnection(workspaceId);
      this.slack.set(conn);
      this.slackModel.set({
        incomingWebhookUrl: '',
        channelLabel: conn.channelLabel ?? '',
      });
    } catch (err: unknown) {
      this.slackError.set(
        err instanceof Error ? err.message : 'Failed to load Slack connection',
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

  async connectSlack(event: Event): Promise<void> {
    event.preventDefault();
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.slackError.set(null);
    await submit(this.slackForm, {
      action: async () => {
        try {
          const m = this.slackModel();
          const conn = await this.workspaces.connectSlack(ws.id, {
            incomingWebhookUrl: m.incomingWebhookUrl.trim(),
            channelLabel: m.channelLabel.trim() || undefined,
          });
          this.slack.set(conn);
          this.slackModel.set({
            incomingWebhookUrl: '',
            channelLabel: conn.channelLabel ?? '',
          });
          await this.workspaces.loadMyWorkspaces();
          this.workspaces.selectWorkspace(ws.id);
          this.message.set('standup.workspace.slackConnected');
        } catch (err: unknown) {
          this.slackError.set(
            err instanceof Error ? err.message : 'Slack connect failed',
          );
        }
        return undefined;
      },
    });
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
