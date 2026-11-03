import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  resolveStandupHome,
  standupHomeUrl,
  standupShellLinks,
  StandupFacade,
  type StandupAccessInput,
} from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type StandupFormModel = {
  yesterday: string;
  today: string;
  blockers: string;
};

@Component({
  selector: 'vs-my-standup',
  imports: [FormField, Shell, TranslocoPipe],
  templateUrl: './my-standup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class MyStandup implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly standup = inject(StandupFacade);
  private readonly preview = inject(PreviewContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

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
  readonly shellLinks = computed(() => {
    this.lang();
    this.workspaces.memberships();
    this.workspaces.selectedWorkspaceId();
    this.standup.teams();
    this.preview.isActive();
    this.preview.workspaceRole();
    return standupShellLinks(this.navInput(), (key) =>
      this.transloco.translate(key),
    );
  });

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
    const enter = this.route.snapshot.queryParamMap.get('enter') === '1';
    const requestedWorkspaceId =
      this.route.snapshot.queryParamMap.get('workspaceId');
    await this.workspaces.loadMyWorkspaces(requestedWorkspaceId);
    const ws = this.workspaces.selectedWorkspace();
    if (!ws) {
      return;
    }
    await this.standup.loadMyTeams(ws.id);
    if (enter) {
      const home = resolveStandupHome(this.navInput());
      if (home !== '/app') {
        await this.router.navigateByUrl(standupHomeUrl(home, ws.id));
        return;
      }
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { enter: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    const teamId = this.standup.selectedTeamId();
    if (teamId) {
      await this.standup.loadToday(teamId);
    }
  }

  private navInput(): StandupAccessInput {
    return {
      workspaceRole: this.workspaces.effectiveWorkspaceRole(),
      teamRoles: this.preview.isActive()
        ? [this.preview.teamRole()]
        : this.standup.teams().map((team) => team.role),
    };
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
