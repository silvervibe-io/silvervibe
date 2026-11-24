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
import { Shell } from '@silvervibe/shared/ui';
import { PollFacade } from '@silvervibe/stores/poll';
import { PollShellLinks } from '../poll-shell-links';

@Component({
  selector: 'vp-poll-detail',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './poll-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class PollDetail implements OnInit {
  private readonly polls = inject(PollFacade);
  private readonly shellLinks = inject(PollShellLinks);

  /** Route param via withComponentInputBinding */
  readonly pollId = input.required<string>();

  readonly links = this.shellLinks.links;
  readonly poll = this.polls.selected;
  readonly results = this.polls.results;
  readonly loading = this.polls.loading;
  readonly error = this.polls.error;
  readonly selectedOptionIds = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    await this.polls.loadPoll(this.pollId());
    const mine = this.poll()?.myOptionIds ?? [];
    this.selectedOptionIds.set([...mine]);
  }

  toggleOption(optionId: string, allowMulti: boolean, checked: boolean): void {
    if (!allowMulti) {
      this.selectedOptionIds.set(checked ? [optionId] : []);
      return;
    }
    const current = new Set(this.selectedOptionIds());
    if (checked) {
      current.add(optionId);
    } else {
      current.delete(optionId);
    }
    this.selectedOptionIds.set([...current]);
  }

  isSelected(optionId: string): boolean {
    return this.selectedOptionIds().includes(optionId);
  }

  async submitVote(): Promise<void> {
    const ids = this.selectedOptionIds();
    if (ids.length === 0) {
      return;
    }
    await this.polls.vote(this.pollId(), ids);
    const mine = this.poll()?.myOptionIds ?? [];
    this.selectedOptionIds.set([...mine]);
  }

  async closePoll(): Promise<void> {
    await this.polls.close(this.pollId());
  }
}
