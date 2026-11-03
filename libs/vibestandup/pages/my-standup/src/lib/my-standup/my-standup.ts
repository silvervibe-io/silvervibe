import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { getVibestandupLimits } from '@silvervibe/shared/feature-flags';
import { Shell } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  formatClock,
  resolveStandupHome,
  standupHomeUrl,
  standupShellLinks,
  submissionPhase,
  StandupFacade,
  type StandupAccessInput,
  type StandupAnswerValue,
  type StandupQuestion,
} from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type AnswerRow = {
  questionId: string;
  text: string;
  optionId: string;
  otherText: string;
};

@Component({
  selector: 'vs-my-standup',
  imports: [Shell, TranslocoPipe],
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
  private readonly destroyRef = inject(DestroyRef);
  readonly clock = signal(Date.now());
  readonly rows = signal<AnswerRow[]>([]);
  readonly formError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly enabledQuestions = computed(() =>
    (this.config()?.questionsJson ?? []).filter((question) => question.enabled),
  );
  readonly phase = computed(() => {
    const config = this.config();
    if (!config) {
      return 'open' as const;
    }
    return submissionPhase(config, new Date(this.clock()));
  });
  readonly opensAt = computed(() => {
    const config = this.config();
    if (!config) {
      return '';
    }
    return config.scheduleKind === 'window'
      ? formatClock(config.windowStartHour, config.windowStartMinute)
      : formatClock(config.reminderHour, config.reminderMinute);
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

  constructor() {
    const timer = setInterval(() => this.clock.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    effect(() => {
      const entry = this.entry();
      const questions = this.enabledQuestions();
      this.rows.set(
        questions.map((question) => {
          const answer = entry?.answersJson[question.id];
          return {
            questionId: question.id,
            text: answer?.text ?? this.legacyText(question, entry) ?? '',
            optionId: answer?.optionId ?? '',
            otherText: answer?.otherText ?? '',
          };
        }),
      );
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

  questionFor(row: AnswerRow): StandupQuestion | undefined {
    return this.enabledQuestions().find(
      (question) => question.id === row.questionId,
    );
  }

  updateRow(questionId: string, patch: Partial<AnswerRow>): void {
    this.rows.update((rows) =>
      rows.map((row) =>
        row.questionId === questionId ? { ...row, ...patch } : row,
      ),
    );
  }

  async saveDraft(event: Event): Promise<void> {
    event.preventDefault();
    await this.persist('DRAFT');
  }

  async submitEntry(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.answersComplete()) {
      this.formError.set('standup.my.missing');
      return;
    }
    await this.persist('SUBMITTED');
  }

  private legacyText(
    question: StandupQuestion,
    entry: {
      yesterday: string | null;
      today: string | null;
      blockers: string | null;
    } | null,
  ): string | null {
    if (!entry) {
      return null;
    }
    if (question.builtin === 'yesterday') {
      return entry.yesterday;
    }
    if (question.builtin === 'today') {
      return entry.today;
    }
    if (question.builtin === 'blockers') {
      return entry.blockers;
    }
    return null;
  }

  private answersComplete(): boolean {
    return this.rows().every((row) => {
      const question = this.questionFor(row);
      if (!question?.required) {
        return true;
      }
      if (question.type === 'text') {
        return row.text.trim().length > 0;
      }
      if (row.optionId === 'other') {
        return row.otherText.trim().length > 0;
      }
      return row.optionId.trim().length > 0;
    });
  }

  private payload() {
    const answers: Record<string, StandupAnswerValue> = {};
    let yesterday = '';
    let today = '';
    let blockers = '';
    for (const row of this.rows()) {
      answers[row.questionId] = {
        text: row.text,
        ...(row.optionId ? { optionId: row.optionId } : {}),
        ...(row.otherText ? { otherText: row.otherText } : {}),
      };
      const question = this.questionFor(row);
      if (question?.builtin === 'yesterday') {
        yesterday = row.text;
      } else if (question?.builtin === 'today') {
        today = row.text;
      } else if (question?.builtin === 'blockers') {
        blockers = row.text;
      }
    }
    return { yesterday, today, blockers, answers };
  }

  private async persist(status: 'DRAFT' | 'SUBMITTED'): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId || this.phase() !== 'open') {
      return;
    }
    this.formError.set(null);
    this.busy.set(true);
    try {
      const body = this.payload();
      if (status === 'DRAFT') {
        await this.standup.saveDraft(teamId, body);
      } else {
        await this.standup.submit(teamId, body);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
