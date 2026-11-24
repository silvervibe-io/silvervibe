import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import { PollFacade } from '@silvervibe/stores/poll';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { PollShellLinks } from '../poll-shell-links';

type CreatePollModel = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  allowMulti: boolean;
  startsAt: string;
  endsAt: string;
};

@Component({
  selector: 'vp-poll-create',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './poll-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class PollCreate implements OnInit {
  private readonly polls = inject(PollFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly router = inject(Router);
  private readonly shellLinks = inject(PollShellLinks);

  readonly links = this.shellLinks.links;
  readonly members = this.polls.members;
  readonly loading = this.polls.loading;
  readonly error = this.polls.error;
  readonly selectedInviteIds = signal<string[]>([]);
  readonly formError = signal<string | null>(null);

  readonly model = signal<CreatePollModel>({
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    allowMulti: false,
    startsAt: '',
    endsAt: '',
  });

  readonly pollForm = form(this.model, (schemaPath) => {
    required(schemaPath.question);
    minLength(schemaPath.question, 3);
    required(schemaPath.optionA);
    required(schemaPath.optionB);
  });

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces(
      this.workspaces.selectedWorkspaceId(),
    );
    const workspaceId = this.workspaces.selectedWorkspaceId();
    if (!workspaceId) {
      return;
    }
    await this.polls.loadMembers(workspaceId);
  }

  toggleInvite(userId: string, checked: boolean): void {
    const current = new Set(this.selectedInviteIds());
    if (checked) {
      current.add(userId);
    } else {
      current.delete(userId);
    }
    this.selectedInviteIds.set([...current]);
  }

  isInvited(userId: string): boolean {
    return this.selectedInviteIds().includes(userId);
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formError.set(null);
    await submit(this.pollForm, {
      action: async () => {
        const workspaceId = this.workspaces.selectedWorkspaceId();
        if (!workspaceId) {
          this.formError.set('poll.create.noWorkspace');
          return undefined;
        }
        const value = this.model();
        const options = [
          value.optionA,
          value.optionB,
          value.optionC,
          value.optionD,
        ]
          .map((label) => label.trim())
          .filter(Boolean);
        if (options.length < 2) {
          this.formError.set('poll.create.needOptions');
          return undefined;
        }
        const toIso = (raw: string): string | null => {
          const trimmed = raw.trim();
          if (!trimmed) {
            return null;
          }
          const date = new Date(trimmed);
          return Number.isNaN(date.getTime()) ? null : date.toISOString();
        };
        const id = await this.polls.createPoll(workspaceId, {
          question: value.question.trim(),
          options,
          allowMulti: value.allowMulti,
          startsAt: toIso(value.startsAt),
          endsAt: toIso(value.endsAt),
          inviteUserIds: this.selectedInviteIds(),
        });
        if (id) {
          await this.router.navigate(['/app/polls', id]);
        }
        return undefined;
      },
    });
  }
}
