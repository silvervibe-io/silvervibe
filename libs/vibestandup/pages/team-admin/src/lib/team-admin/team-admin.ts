import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import {
  StandupFacade,
  type TeamInviteView,
  type TeamMemberView,
} from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type ConfigModel = {
  timezone: string;
  yesterday: string;
  today: string;
  blockers: string;
};

type InviteModel = {
  email: string;
};

@Component({
  selector: 'vs-team-admin',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './team-admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class TeamAdmin implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly standup = inject(StandupFacade);

  readonly loading = this.standup.loading;
  readonly error = this.standup.error;
  readonly teams = this.standup.teams;
  readonly selectedTeamId = this.standup.selectedTeamId;
  readonly teamEntries = this.standup.teamEntries;
  readonly summary = this.standup.summary;
  readonly members = signal<TeamMemberView[]>([]);
  readonly pendingInvites = signal<TeamInviteView[]>([]);
  readonly message = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly lastInviteLink = signal<string | null>(null);

  readonly configModel = signal<ConfigModel>({
    timezone: 'UTC',
    yesterday: 'What did you do yesterday?',
    today: 'What will you do today?',
    blockers: 'Any blockers?',
  });

  readonly configForm = form(this.configModel, (schemaPath) => {
    required(schemaPath.timezone);
  });

  readonly inviteModel = signal<InviteModel>({ email: '' });
  readonly inviteForm = form(this.inviteModel, (schemaPath) => {
    required(schemaPath.email);
    email(schemaPath.email);
  });

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces();
    const ws = this.workspaces.selectedWorkspace();
    if (!ws) {
      return;
    }
    await this.standup.loadMyTeams(ws.id);
    const teamId = this.standup.selectedTeamId();
    if (teamId) {
      await this.refreshTeam(teamId);
    }
  }

  async onTeamChange(teamId: string): Promise<void> {
    this.standup.selectTeam(teamId);
    await this.refreshTeam(teamId);
  }

  private async refreshTeam(teamId: string): Promise<void> {
    await this.standup.loadTeamAdmin(teamId);
    const config = this.standup.config();
    if (config) {
      this.configModel.set({
        timezone: config.timezone,
        yesterday: config.questionsJson['yesterday'] ?? '',
        today: config.questionsJson['today'] ?? '',
        blockers: config.questionsJson['blockers'] ?? '',
      });
    }
    const [members, invites] = await Promise.all([
      this.standup.listMembers(teamId),
      this.standup.listInvites(teamId),
    ]);
    this.members.set(members);
    this.pendingInvites.set(invites);
  }

  async saveConfig(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await submit(this.configForm, {
      action: async () => {
        const m = this.configModel();
        await this.standup.saveConfig(teamId, {
          timezone: m.timezone,
          questionsJson: {
            yesterday: m.yesterday,
            today: m.today,
            blockers: m.blockers,
          },
        });
        this.message.set('standup.team.saved');
        return undefined;
      },
    });
  }

  async invite(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.inviteError.set(null);
    this.lastInviteLink.set(null);
    await submit(this.inviteForm, {
      action: async () => {
        try {
          const result = await this.standup.inviteByEmail(
            teamId,
            this.inviteModel().email.trim(),
          );
          this.inviteModel.set({ email: '' });
          if (result.status === 'ACCEPTED') {
            this.message.set('standup.team.inviteAccepted');
            this.inviteError.set(null);
          } else {
            this.message.set(
              result.emailSent
                ? 'standup.team.inviteEmailSent'
                : 'standup.team.invitePending',
            );
            this.inviteError.set(
              result.emailSent ? null : (result.emailError ?? null),
            );
            this.lastInviteLink.set(
              `${window.location.origin}${result.acceptPath}`,
            );
          }
          await this.refreshTeam(teamId);
        } catch (err: unknown) {
          this.inviteError.set(
            err instanceof Error ? err.message : 'Invite failed',
          );
        }
        return undefined;
      },
    });
  }

  async copyInviteLink(path: string): Promise<void> {
    const url = path.startsWith('http')
      ? path
      : `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      this.message.set('standup.team.linkCopied');
      this.lastInviteLink.set(url);
    } catch {
      this.lastInviteLink.set(url);
    }
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await this.standup.revokeInvite(teamId, inviteId);
    this.message.set('standup.team.inviteRevoked');
    await this.refreshTeam(teamId);
  }

  async rebuildSummary(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await this.standup.refreshSummary(teamId);
  }
}
