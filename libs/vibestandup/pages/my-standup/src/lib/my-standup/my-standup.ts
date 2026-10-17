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
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import { StandupStore } from '@silvervibe/stores/standup';
import { WorkspaceStore } from '@silvervibe/stores/workspace';

type StandupFormModel = {
  yesterday: string;
  today: string;
  blockers: string;
};

@Component({
  selector: 'vs-my-standup',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './my-standup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class MyStandup implements OnInit {
  private readonly workspaces = inject(WorkspaceStore);
  private readonly standup = inject(StandupStore);
  private readonly preview = inject(PreviewContextStore);

  readonly loading = this.standup.loading;
  readonly error = this.standup.error;
  readonly entry = this.standup.entry;
  readonly summary = this.standup.summary;
  readonly config = this.standup.config;
  readonly teams = this.standup.teams;
  readonly selectedTeamId = this.standup.selectedTeamId;
  readonly isTeamAdmin = () => this.standup.isTeamAdmin();
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
  readonly busy = signal(false);

  readonly model = signal<StandupFormModel>({
    yesterday: '',
    today: '',
    blockers: '',
  });

  readonly standupForm = form(this.model, (schemaPath) => {
    required(schemaPath.yesterday);
    required(schemaPath.today);
  });

  constructor() {
    effect(() => {
      const entry = this.entry();
      if (!entry) {
        return;
      }
      this.model.set({
        yesterday: entry.yesterday ?? '',
        today: entry.today ?? '',
        blockers: entry.blockers ?? '',
      });
    });
  }

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces();
    const ws = this.workspaces.selectedWorkspace();
    if (!ws) {
      return;
    }
    await this.standup.loadMyTeams(ws.id);
    const teamId = this.standup.selectedTeamId();
    if (teamId) {
      await this.standup.loadToday(teamId);
    }
  }

  async onTeamChange(teamId: string): Promise<void> {
    this.standup.selectTeam(teamId);
    await this.standup.loadToday(teamId);
  }

  async saveDraft(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.busy.set(true);
    try {
      await submit(this.standupForm, {
        action: async () => {
          await this.standup.saveDraft(teamId, this.model());
          return undefined;
        },
      });
    } finally {
      this.busy.set(false);
    }
  }

  async submitEntry(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.busy.set(true);
    try {
      await submit(this.standupForm, {
        action: async () => {
          await this.standup.submit(teamId, this.model());
          return undefined;
        },
      });
    } finally {
      this.busy.set(false);
    }
  }
}
