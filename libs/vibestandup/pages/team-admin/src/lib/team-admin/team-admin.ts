import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import { StandupFacade, type TeamMemberView } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type ConfigModel = {
  timezone: string;
  yesterday: string;
  today: string;
  blockers: string;
};

type InviteModel = {
  userId: string;
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
  readonly message = signal<string | null>(null);

  readonly configModel = signal<ConfigModel>({
    timezone: 'UTC',
    yesterday: 'What did you do yesterday?',
    today: 'What will you do today?',
    blockers: 'Any blockers?',
  });

  readonly configForm = form(this.configModel, (schemaPath) => {
    required(schemaPath.timezone);
  });

  readonly inviteModel = signal<InviteModel>({ userId: '' });
  readonly inviteForm = form(this.inviteModel, (schemaPath) => {
    required(schemaPath.userId);
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
    this.members.set(await this.standup.listMembers(teamId));
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
    await submit(this.inviteForm, {
      action: async () => {
        await this.standup.inviteMember(teamId, this.inviteModel().userId);
        this.inviteModel.set({ userId: '' });
        await this.refreshTeam(teamId);
        return undefined;
      },
    });
  }

  async rebuildSummary(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await this.standup.refreshSummary(teamId);
  }
}
