import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Callout, SettingsSection, Shell } from '@silvervibe/shared/ui';
import { FeedbackFacade } from '@silvervibe/stores/feedback';
import { FeedbackShellLinks } from '../feedback-shell-links';

@Component({
  selector: 'vf-feedback-detail',
  imports: [RouterLink, Shell, TranslocoPipe, SettingsSection, Callout],
  templateUrl: './feedback-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class FeedbackDetail implements OnInit {
  private readonly feedback = inject(FeedbackFacade);
  private readonly shellLinks = inject(FeedbackShellLinks);

  readonly requestId = input.required<string>();

  readonly links = this.shellLinks.links;
  readonly request = this.feedback.selected;
  readonly loading = this.feedback.loading;
  readonly error = this.feedback.error;

  readonly drafts = signal<Record<string, string>>({});
  readonly summaryDraft = signal('');

  readonly answersByPrompt = computed(() => {
    const answers = this.request()?.answers ?? [];
    const map: Record<string, typeof answers> = {};
    for (const answer of answers) {
      const list = map[answer.promptId] ?? [];
      list.push(answer);
      map[answer.promptId] = list;
    }
    return map;
  });

  async ngOnInit(): Promise<void> {
    await this.feedback.loadRequest(this.requestId());
    const item = this.request();
    this.summaryDraft.set(item?.summary ?? '');
    const next: Record<string, string> = {};
    for (const prompt of item?.prompts ?? []) {
      const mine = (item?.answers ?? []).find(
        (answer) => answer.promptId === prompt.id && answer.mine,
      );
      next[prompt.id] = mine?.body ?? '';
    }
    this.drafts.set(next);
  }

  setDraft(promptId: string, body: string): void {
    this.drafts.set({ ...this.drafts(), [promptId]: body });
  }

  async saveAnswers(): Promise<void> {
    const answers = Object.entries(this.drafts())
      .map(([promptId, body]) => ({ promptId, body: body.trim() }))
      .filter((entry) => entry.body.length > 0);
    if (answers.length === 0) {
      return;
    }
    await this.feedback.upsertAnswers(this.requestId(), { answers });
  }

  async closeRequest(): Promise<void> {
    await this.feedback.close(this.requestId(), this.summaryDraft().trim());
  }
}
