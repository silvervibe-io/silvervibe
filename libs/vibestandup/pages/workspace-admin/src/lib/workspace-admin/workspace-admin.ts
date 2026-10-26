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
  type SlackConnectionView,
  type TeamsConnectionView,
  type TeamsGraphChannelView,
  type TeamsGraphTeamView,
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
  readonly teams = signal<TeamsConnectionView | null>(null);
  readonly teamsError = signal<string | null>(null);
  readonly teamsConnecting = signal(false);
  readonly teamsJoined = signal<TeamsGraphTeamView[]>([]);
  readonly teamsChannels = signal<TeamsGraphChannelView[]>([]);
  readonly selectedMsTeamId = signal('');
  readonly selectedMsChannelId = signal('');

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
      await Promise.all([this.refreshSlack(ws.id), this.refreshTeams(ws.id)]);
    }
    this.applyQueryResults();
  }

  private applyQueryResults(): void {
    const params = this.route.snapshot.queryParamMap;
    const slack = params.get('slack');
    const teams = params.get('teams');
    if (slack === 'connected') {
      this.message.set('standup.workspace.slackConnected');
    } else if (slack === 'error') {
      this.slackError.set(params.get('slackDetail') || 'Slack connect failed');
    }
    if (teams === 'pick' || teams === 'connected') {
      this.message.set(
        teams === 'pick'
          ? 'standup.workspace.teamsPickChannel'
          : 'standup.workspace.teamsConnected',
      );
      const ws = this.selected();
      if (ws && this.isAdmin()) {
        void this.loadTeamsPicker(ws.id);
      }
    } else if (teams === 'error') {
      this.teamsError.set(params.get('teamsDetail') || 'Teams connect failed');
    }
    if (slack || teams) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          slack: null,
          slackDetail: null,
          teams: null,
          teamsDetail: null,
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.selectWorkspace(workspaceId);
    this.slack.set(null);
    this.slackError.set(null);
    this.teams.set(null);
    this.teamsError.set(null);
    this.teamsJoined.set([]);
    this.teamsChannels.set([]);
    this.selectedMsTeamId.set('');
    this.selectedMsChannelId.set('');
    if (this.isAdmin()) {
      await Promise.all([
        this.refreshSlack(workspaceId),
        this.refreshTeams(workspaceId),
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

  private async refreshTeams(workspaceId: string): Promise<void> {
    try {
      const conn = await this.workspaces.getTeamsConnection(workspaceId);
      this.teams.set(conn);
      if (conn.needsChannel) {
        await this.loadTeamsPicker(workspaceId);
      }
    } catch (err: unknown) {
      this.teamsError.set(
        err instanceof Error ? err.message : 'Failed to load Teams connection',
      );
    }
  }

  private httpErrorMessage(err: unknown, fallback: string): string {
    if (
      err &&
      typeof err === 'object' &&
      'error' in err &&
      (err as { error?: unknown }).error &&
      typeof (err as { error: unknown }).error === 'object'
    ) {
      const body = (err as { error: Record<string, unknown> }).error;
      const msg = body['message'];
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
    return err instanceof Error && err.message.trim() ? err.message : fallback;
  }

  private async loadTeamsPicker(workspaceId: string): Promise<void> {
    try {
      const joined = await this.workspaces.listTeamsJoined(workspaceId);
      this.teamsJoined.set(joined);
      if (joined.length === 0) {
        this.teamsError.set(
          'No Microsoft Teams found for this account. Create or join a Team in Microsoft Teams, then refresh.',
        );
        return;
      }
      if (!this.selectedMsTeamId()) {
        this.selectedMsTeamId.set(joined[0].id);
        await this.onMsTeamChange(joined[0].id);
      }
    } catch (err: unknown) {
      this.teamsError.set(
        this.httpErrorMessage(err, 'Failed to list Microsoft Teams'),
      );
    }
  }

  async onMsTeamChange(teamId: string): Promise<void> {
    this.selectedMsTeamId.set(teamId);
    this.selectedMsChannelId.set('');
    this.teamsChannels.set([]);
    const ws = this.selected();
    if (!ws || !teamId) {
      return;
    }
    try {
      const channels = await this.workspaces.listTeamsChannels(ws.id, teamId);
      this.teamsChannels.set(channels);
      if (channels.length > 0) {
        this.selectedMsChannelId.set(channels[0].id);
      }
    } catch (err: unknown) {
      this.teamsError.set(
        this.httpErrorMessage(err, 'Failed to list channels'),
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

  async connectTeams(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.teamsError.set(null);
    this.teamsConnecting.set(true);
    try {
      const { authorizeUrl } = await this.workspaces.startTeamsOAuth(ws.id);
      window.location.assign(authorizeUrl);
    } catch (err: unknown) {
      this.teamsConnecting.set(false);
      this.teamsError.set(
        err instanceof Error ? err.message : 'Teams connect failed',
      );
    }
  }

  async saveTeamsChannel(): Promise<void> {
    const ws = this.selected();
    const teamId = this.selectedMsTeamId();
    const channelId = this.selectedMsChannelId();
    if (!ws || !this.isAdmin() || !teamId || !channelId) {
      return;
    }
    this.teamsError.set(null);
    try {
      const channel = this.teamsChannels().find((c) => c.id === channelId);
      const conn = await this.workspaces.selectTeamsChannel(ws.id, {
        teamId,
        channelId,
        channelLabel: channel?.displayName,
      });
      this.teams.set(conn);
      await this.workspaces.loadMyWorkspaces();
      this.workspaces.selectWorkspace(ws.id);
      this.message.set('standup.workspace.teamsConnected');
    } catch (err: unknown) {
      this.teamsError.set(
        err instanceof Error ? err.message : 'Failed to save Teams channel',
      );
    }
  }

  async disconnectTeams(): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    this.teamsError.set(null);
    try {
      const conn = await this.workspaces.disconnectTeams(ws.id);
      this.teams.set(conn);
      this.teamsJoined.set([]);
      this.teamsChannels.set([]);
      this.message.set('standup.workspace.teamsDisconnected');
    } catch (err: unknown) {
      this.teamsError.set(
        err instanceof Error ? err.message : 'Teams disconnect failed',
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
