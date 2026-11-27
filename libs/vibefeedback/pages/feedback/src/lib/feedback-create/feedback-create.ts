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
import {
  Callout,
  EmptyState,
  FieldHelp,
  SettingsSection,
  Shell,
  StepHeader,
} from '@silvervibe/shared/ui';
import {
  FeedbackFacade,
  type FeedbackAnswerVisibility,
  type FeedbackClosePolicy,
} from '@silvervibe/stores/feedback';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { FeedbackShellLinks } from '../feedback-shell-links';

type CreateFeedbackModel = {
  title: string;
  context: string;
  answerVisibility: FeedbackAnswerVisibility;
  anonymous: boolean;
  closePolicy: FeedbackClosePolicy;
  endsAt: string;
};

@Component({
  selector: 'vf-feedback-create',
  imports: [
    FormField,
    RouterLink,
    Shell,
    TranslocoPipe,
    SettingsSection,
    FieldHelp,
    EmptyState,
    StepHeader,
    Callout,
  ],
  templateUrl: './feedback-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class FeedbackCreate implements OnInit {
  private readonly feedback = inject(FeedbackFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly router = inject(Router);
  private readonly shellLinks = inject(FeedbackShellLinks);

  readonly links = this.shellLinks.links;
  readonly members = this.feedback.members;
  readonly loading = this.feedback.loading;
  readonly error = this.feedback.error;
  readonly selectedInviteIds = signal<string[]>([]);
  readonly prompts = signal<string[]>(['']);
  readonly formError = signal<string | null>(null);

  readonly visibilityOptions: FeedbackAnswerVisibility[] = [
    'PRIVATE_TO_REQUESTER',
    'SHARED_WITH_INVITEES',
  ];
  readonly closeOptions: FeedbackClosePolicy[] = [
    'CREATOR_OR_ADMIN',
    'CREATOR_ONLY',
    'ANY_INVITEE',
  ];

  readonly model = signal<CreateFeedbackModel>({
    title: '',
    context: '',
    answerVisibility: 'PRIVATE_TO_REQUESTER',
    anonymous: false,
    closePolicy: 'CREATOR_OR_ADMIN',
    endsAt: '',
  });

  readonly feedbackForm = form(this.model, (schemaPath) => {
    required(schemaPath.title);
    minLength(schemaPath.title, 3);
    required(schemaPath.answerVisibility);
    required(schemaPath.closePolicy);
  });

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces(
      this.workspaces.selectedWorkspaceId(),
    );
    const workspaceId = this.workspaces.selectedWorkspaceId();
    if (!workspaceId) {
      return;
    }
    await this.feedback.loadMembers(workspaceId);
  }

  addPrompt(): void {
    this.prompts.set([...this.prompts(), '']);
  }

  updatePrompt(index: number, value: string): void {
    const next = [...this.prompts()];
    next[index] = value;
    this.prompts.set(next);
  }

  removePrompt(index: number): void {
    if (this.prompts().length <= 1) {
      return;
    }
    this.prompts.set(this.prompts().filter((_, i) => i !== index));
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
    await submit(this.feedbackForm, {
      action: async () => {
        const workspaceId = this.workspaces.selectedWorkspaceId();
        if (!workspaceId) {
          this.formError.set('feedback.create.noWorkspace');
          return undefined;
        }
        const cleanedPrompts = this.prompts()
          .map((prompt) => prompt.trim())
          .filter(Boolean);
        if (cleanedPrompts.length < 1) {
          this.formError.set('feedback.create.needPrompts');
          return undefined;
        }
        const value = this.model();
        const toIso = (raw: string): string | null => {
          const trimmed = raw.trim();
          if (!trimmed) {
            return null;
          }
          const date = new Date(trimmed);
          return Number.isNaN(date.getTime()) ? null : date.toISOString();
        };
        const id = await this.feedback.createRequest(workspaceId, {
          title: value.title.trim(),
          context: value.context.trim() || null,
          prompts: cleanedPrompts,
          answerVisibility: value.answerVisibility,
          anonymous: value.anonymous,
          closePolicy: value.closePolicy,
          endsAt: toIso(value.endsAt),
          inviteUserIds: this.selectedInviteIds(),
        });
        if (id) {
          await this.router.navigate(['/app/requests', id]);
        }
        return undefined;
      },
    });
  }
}
