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
import { Shell, StandupSummary } from '@silvervibe/shared/ui';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  activeMentionToken,
  formatClock,
  issueMention,
  personMention,
  plainMentions,
  resolveStandupHome,
  standupHomeUrl,
  standupShellLinks,
  submissionPhase,
  StandupFacade,
  type MentionIssueView,
  type StandupAccessInput,
  type ReplyNeeded,
  type StandupAnswerValue,
  type StandupQuestion,
  type StandupRecentDay,
  type TeamMemberView,
} from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

type AnswerRow = {
  questionId: string;
  text: string;
  optionId: string;
  otherText: string;
  helpFrom: string;
  replyNeeded: '' | ReplyNeeded;
};

type MentionSession = {
  questionId: string;
  kind: 'person' | 'issue';
  query: string;
  start: number;
  end: number;
  loading: boolean;
};

type MentionChoice = {
  id: string;
  label: string;
  detail: string;
  markdown: string;
};

@Component({
  selector: 'vs-my-standup',
  imports: [Shell, StandupSummary, TranslocoPipe],
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

  readonly ready = signal(false);
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
  private issueTimer: ReturnType<typeof setTimeout> | null = null;
  readonly clock = signal(Date.now());
  readonly rows = signal<AnswerRow[]>([]);
  readonly members = signal<TeamMemberView[]>([]);
  readonly awayDates = signal<string[]>([]);
  readonly recentDays = signal<StandupRecentDay[]>([]);
  readonly selectedSummaryDate = signal<string | null>(null);
  readonly selectedSummary = computed(() => {
    const selected = this.selectedSummaryDate();
    return (
      this.recentDays().find((day) => day.entryDate === selected) ??
      this.recentDays()[0] ??
      null
    );
  });
  readonly awayDays = computed(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + index,
        ),
      );
      return day.toISOString().slice(0, 10);
    });
  });
  readonly mention = signal<MentionSession | null>(null);
  readonly mentionIndex = signal(0);
  readonly issueHits = signal<MentionIssueView[]>([]);
  readonly workSuggestions = signal<MentionIssueView[]>([]);
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
    return formatClock(config.windowStartHour, config.windowStartMinute);
  });
  readonly closesAt = computed(() => {
    const config = this.config();
    if (!config) {
      return '';
    }
    return formatClock(config.reminderHour, config.reminderMinute);
  });
  readonly summaryHidden = computed(
    () =>
      this.config()?.reveal === 'together' &&
      !this.isTeamAdmin() &&
      !this.summary(),
  );
  readonly mentionChoices = computed<MentionChoice[]>(() => {
    this.lang();
    const current = this.mention();
    if (!current) {
      return [];
    }
    if (current.kind === 'person') {
      const query = current.query.trim().toLowerCase();
      return this.members()
        .filter((member) => {
          const name =
            `${member.displayName ?? ''} ${member.email ?? ''}`.toLowerCase();
          return !query || name.includes(query);
        })
        .slice(0, 8)
        .map((member) => {
          const label = member.displayName || member.email || member.userId;
          return {
            id: member.userId,
            label,
            detail: member.displayName && member.email ? member.email : '',
            markdown: personMention(label),
          };
        });
    }
    return this.issueHits().map((issue) => ({
      id: `${issue.provider}:${issue.key}`,
      label: issue.key,
      detail: `${this.providerLabel(issue.provider)} · ${issue.title}`,
      markdown: issueMention(issue.key),
    }));
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
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      if (this.issueTimer) {
        clearTimeout(this.issueTimer);
      }
    });
    effect(() => {
      const entry = this.entry();
      const questions = this.enabledQuestions();
      this.rows.set(
        questions.map((question) => {
          const answer = entry?.answersJson[question.id];
          return {
            questionId: question.id,
            text: plainMentions(
              answer?.text ?? this.legacyText(question, entry) ?? '',
            ),
            optionId: answer?.optionId ?? '',
            otherText: answer?.otherText ?? '',
            helpFrom: answer?.helpFrom ?? '',
            replyNeeded: answer?.replyNeeded ?? '',
          };
        }),
      );
    });
  }

  async ngOnInit(): Promise<void> {
    try {
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
        await Promise.all([
          this.standup.loadToday(teamId),
          this.refreshMembers(teamId),
          this.refreshAway(teamId),
          this.refreshRecent(teamId),
          this.refreshSuggestions(teamId),
        ]);
      }
    } finally {
      this.ready.set(true);
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
    this.mention.set(null);
    this.standup.selectTeam(teamId);
    await Promise.all([
      this.standup.loadToday(teamId),
      this.refreshMembers(teamId),
      this.refreshAway(teamId),
      this.refreshRecent(teamId),
      this.refreshSuggestions(teamId),
    ]);
  }

  mentionFor(questionId: string): MentionSession | null {
    const current = this.mention();
    return current?.questionId === questionId ? current : null;
  }

  onAnswerInput(questionId: string, event: Event): void {
    const el = event.target;
    if (!(el instanceof HTMLTextAreaElement)) {
      return;
    }
    const text = el.value;
    this.updateRow(questionId, { text });
    const caret = el.selectionStart ?? text.length;
    const token = activeMentionToken(text, caret);
    if (!token) {
      this.mention.set(null);
      return;
    }
    this.mention.set({
      questionId,
      kind: token.kind,
      query: token.query,
      start: token.start,
      end: caret,
      loading: false,
    });
    this.mentionIndex.set(0);
    if (token.kind === 'person') {
      this.issueHits.set([]);
      return;
    }
    const query = token.query.trim();
    if (query.length < 2) {
      this.issueHits.set([]);
      return;
    }
    this.queueIssueSearch(query);
  }

  onAnswerKeydown(questionId: string, event: KeyboardEvent): void {
    const open = this.mentionFor(questionId);
    const choices = open ? this.mentionChoices() : [];
    if (!open || choices.length === 0) {
      if (event.key === 'Escape') {
        this.mention.set(null);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.mentionIndex.update((index) => (index + 1) % choices.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.mentionIndex.update(
        (index) => (index - 1 + choices.length) % choices.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.applyMention(questionId, this.mentionIndex(), event.target);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.mention.set(null);
    }
  }

  chooseMention(questionId: string, index: number): void {
    this.applyMention(questionId, index);
  }

  questionFor(row: AnswerRow): StandupQuestion | undefined {
    return this.enabledQuestions().find(
      (question) => question.id === row.questionId,
    );
  }

  private providerLabel(provider: MentionIssueView['provider']): string {
    const key =
      provider === 'github'
        ? 'standup.my.providerGithub'
        : provider === 'gitlab'
          ? 'standup.my.providerGitlab'
          : provider === 'jira'
            ? 'standup.my.providerJira'
            : 'standup.my.providerLinear';
    return this.transloco.translate(key);
  }

  private async refreshMembers(teamId: string): Promise<void> {
    try {
      this.members.set(await this.standup.listMembers(teamId));
    } catch {
      this.members.set([]);
    }
  }

  private queueIssueSearch(query: string): void {
    if (this.issueTimer) {
      clearTimeout(this.issueTimer);
    }
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.mention.update((current) =>
      current ? { ...current, loading: true } : current,
    );
    this.issueTimer = setTimeout(() => {
      void this.runIssueSearch(teamId, query);
    }, 250);
  }

  private async runIssueSearch(teamId: string, query: string): Promise<void> {
    const current = this.mention();
    if (
      !current ||
      current.kind !== 'issue' ||
      current.query.trim() !== query
    ) {
      return;
    }
    try {
      const hits = await this.standup.searchIssues(teamId, query);
      if (this.mention()?.query.trim() !== query) {
        return;
      }
      this.issueHits.set(hits);
      this.mentionIndex.set(0);
    } catch {
      this.issueHits.set([]);
    } finally {
      this.mention.update((session) =>
        session ? { ...session, loading: false } : session,
      );
    }
  }

  private applyMention(
    questionId: string,
    index: number,
    target?: EventTarget | null,
  ): void {
    const session = this.mentionFor(questionId);
    const choice = this.mentionChoices()[index];
    if (!session || !choice) {
      return;
    }
    const row = this.rows().find((item) => item.questionId === questionId);
    if (!row) {
      return;
    }
    const inserted = `${choice.markdown} `;
    const next =
      row.text.slice(0, session.start) + inserted + row.text.slice(session.end);
    this.updateRow(questionId, { text: next });
    this.mention.set(null);
    this.issueHits.set([]);
    const caret = session.start + inserted.length;
    if (target instanceof HTMLTextAreaElement) {
      queueMicrotask(() => {
        target.value = next;
        target.setSelectionRange(caret, caret);
      });
    }
  }

  awayChecked(event: Event): boolean {
    const target = event.target;
    return target instanceof HTMLInputElement && target.checked;
  }

  isAway(date: string): boolean {
    return this.awayDates().includes(date);
  }

  async toggleAway(date: string, away: boolean): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.awayDates.set(await this.standup.setAway(teamId, date, away));
  }

  acceptSuggestion(issue: MentionIssueView): void {
    const questionId =
      this.rows().find((row) => row.questionId === 'today')?.questionId ??
      this.enabledQuestions()[0]?.id;
    if (!questionId) {
      return;
    }
    const line = issueMention(issue.key);
    const current =
      this.rows().find((row) => row.questionId === questionId)?.text ?? '';
    const text = current.trim() ? `${current.trim()}\n${line}` : line;
    this.updateRow(questionId, { text });
    this.dismissSuggestion(issue);
  }

  dismissSuggestion(issue: MentionIssueView): void {
    this.workSuggestions.update((items) =>
      items.filter(
        (item) => item.provider !== issue.provider || item.key !== issue.key,
      ),
    );
  }

  private async refreshSuggestions(teamId: string): Promise<void> {
    try {
      this.workSuggestions.set(await this.standup.listRecentWork(teamId));
    } catch {
      this.workSuggestions.set([]);
    }
  }

  private async refreshRecent(teamId: string): Promise<void> {
    try {
      const days = await this.standup.listRecentSummaries(teamId);
      this.recentDays.set(days);
      const selected = this.selectedSummaryDate();
      if (!selected || !days.some((day) => day.entryDate === selected)) {
        this.selectedSummaryDate.set(days[0]?.entryDate ?? null);
      }
    } catch {
      this.recentDays.set([]);
      this.selectedSummaryDate.set(null);
    }
  }

  private async refreshAway(teamId: string): Promise<void> {
    try {
      this.awayDates.set(await this.standup.listAwayDates(teamId));
    } catch {
      this.awayDates.set([]);
    }
  }

  memberMention(member: TeamMemberView): string {
    return personMention(member.displayName || member.email || member.userId);
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
        ...(row.helpFrom ? { helpFrom: row.helpFrom } : {}),
        ...(row.replyNeeded ? { replyNeeded: row.replyNeeded } : {}),
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
