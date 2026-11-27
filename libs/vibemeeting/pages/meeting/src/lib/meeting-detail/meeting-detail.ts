import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Callout, SettingsSection, Shell } from '@silvervibe/shared/ui';
import { MeetingFacade } from '@silvervibe/stores/meeting';
import { MeetingShellLinks } from '../meeting-shell-links';

export type ActionDraft = {
  body: string;
  assigneeId: string;
  done: boolean;
};

@Component({
  selector: 'vm-meeting-detail',
  imports: [
    DatePipe,
    RouterLink,
    Shell,
    TranslocoPipe,
    SettingsSection,
    Callout,
  ],
  templateUrl: './meeting-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class MeetingDetail implements OnInit {
  private readonly meetingFacade = inject(MeetingFacade);
  private readonly shellLinks = inject(MeetingShellLinks);

  readonly meetingId = input.required<string>();

  readonly links = this.shellLinks.links;
  readonly meeting = this.meetingFacade.selected;
  readonly loading = this.meetingFacade.loading;
  readonly error = this.meetingFacade.error;

  readonly decisionDrafts = signal<string[]>([]);
  readonly actionDrafts = signal<ActionDraft[]>([]);
  readonly recapDraft = signal('');

  async ngOnInit(): Promise<void> {
    await this.meetingFacade.loadMeeting(this.meetingId());
    this.syncDrafts();
    this.recapDraft.set(this.meeting()?.recap ?? '');
  }

  addDecision(): void {
    this.decisionDrafts.set([...this.decisionDrafts(), '']);
  }

  updateDecision(index: number, value: string): void {
    const next = [...this.decisionDrafts()];
    next[index] = value;
    this.decisionDrafts.set(next);
  }

  removeDecision(index: number): void {
    this.decisionDrafts.set(
      this.decisionDrafts().filter((_, i) => i !== index),
    );
  }

  addAction(): void {
    this.actionDrafts.set([
      ...this.actionDrafts(),
      { body: '', assigneeId: '', done: false },
    ]);
  }

  updateAction(index: number, patch: Partial<ActionDraft>): void {
    this.actionDrafts.set(
      this.actionDrafts().map((draft, i) =>
        i === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  removeAction(index: number): void {
    this.actionDrafts.set(this.actionDrafts().filter((_, i) => i !== index));
  }

  async saveDecisions(): Promise<void> {
    const decisions = this.decisionDrafts()
      .map((body) => body.trim())
      .filter((body) => body.length > 0)
      .map((body) => ({ body }));
    await this.meetingFacade.setDecisions(this.meetingId(), { decisions });
    this.syncDrafts();
  }

  async saveActions(): Promise<void> {
    const actions = this.actionDrafts()
      .map((draft) => ({ ...draft, body: draft.body.trim() }))
      .filter((draft) => draft.body.length > 0)
      .map((draft) => ({
        body: draft.body,
        assigneeId: draft.assigneeId || null,
        done: draft.done,
      }));
    await this.meetingFacade.setActions(this.meetingId(), { actions });
    this.syncDrafts();
  }

  async closeMeeting(): Promise<void> {
    await this.meetingFacade.close(this.meetingId(), this.recapDraft().trim());
  }

  private syncDrafts(): void {
    const item = this.meeting();
    this.decisionDrafts.set((item?.decisions ?? []).map((d) => d.body));
    this.actionDrafts.set(
      (item?.actions ?? []).map((a) => ({
        body: a.body,
        assigneeId: a.assigneeId ?? '',
        done: a.done,
      })),
    );
  }
}
