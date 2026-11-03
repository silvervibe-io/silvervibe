import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  defaultWeek,
  standupShellLinks,
  StandupFacade,
  type StandupAccessInput,
  type Weekday,
  type WeekSchedule,
} from '@silvervibe/stores/standup';
import { UserService } from '@silvervibe/stores/user';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type SettingsModel = {
  timezone: string;
};

@Component({
  selector: 'vs-member-settings',
  imports: [FormField, Shell, TranslocoPipe],
  templateUrl: './member-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen' },
})
export class MemberSettings implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly standup = inject(StandupFacade);
  private readonly users = inject(UserService);
  private readonly preview = inject(PreviewContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly weekdays: Weekday[] = [
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
  ];
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);
  readonly model = signal<SettingsModel>({ timezone: 'UTC' });
  readonly week = signal<WeekSchedule>(defaultWeek());
  readonly settingsForm = form(this.model, (schemaPath) => {
    required(schemaPath.timezone);
  });
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

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces(
      this.route.snapshot.queryParamMap.get('workspaceId'),
    );
    const workspace = this.workspaces.selectedWorkspace();
    if (workspace) {
      await this.standup.loadMyTeams(workspace.id);
    }
    try {
      const schedule = await this.users.getSchedule();
      this.model.set({ timezone: schedule.timezone });
      this.week.set(schedule.workHours);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'schedule.invalid');
    } finally {
      this.loading.set(false);
    }
  }

  updateDay(weekday: Weekday, patch: Partial<WeekSchedule[Weekday]>): void {
    this.week.update((week) => ({
      ...week,
      [weekday]: { ...week[weekday], ...patch },
    }));
    this.saved.set(false);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const timezone = this.model().timezone.trim();
    if (!timezone) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      const schedule = await this.users.updateSchedule({
        timezone,
        workHours: this.week(),
      });
      this.model.set({ timezone: schedule.timezone });
      this.week.set(schedule.workHours);
      this.saved.set(true);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'schedule.invalid');
    } finally {
      this.busy.set(false);
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
}
