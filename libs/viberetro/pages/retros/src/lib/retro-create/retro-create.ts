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
import {
  RetroFacade,
  type RetroClosePolicy,
  type RetroNoteVisibility,
} from '@silvervibe/stores/retro';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { RetroShellLinks } from '../retro-shell-links';

type CreateRetroModel = {
  title: string;
  noteVisibility: RetroNoteVisibility;
  closePolicy: RetroClosePolicy;
  endsAt: string;
};

@Component({
  selector: 'vr-retro-create',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './retro-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class RetroCreate implements OnInit {
  private readonly retros = inject(RetroFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly router = inject(Router);
  private readonly shellLinks = inject(RetroShellLinks);

  readonly links = this.shellLinks.links;
  readonly members = this.retros.members;
  readonly loading = this.retros.loading;
  readonly error = this.retros.error;
  readonly selectedInviteIds = signal<string[]>([]);
  readonly formError = signal<string | null>(null);

  readonly visibilityOptions: RetroNoteVisibility[] = [
    'LIVE',
    'PRIVATE_UNTIL_CLOSE',
    'AFTER_CONTRIBUTE',
  ];
  readonly closeOptions: RetroClosePolicy[] = [
    'CREATOR_OR_ADMIN',
    'CREATOR_ONLY',
    'ANY_INVITEE',
  ];

  readonly model = signal<CreateRetroModel>({
    title: '',
    noteVisibility: 'LIVE',
    closePolicy: 'CREATOR_OR_ADMIN',
    endsAt: '',
  });

  readonly retroForm = form(this.model, (schemaPath) => {
    required(schemaPath.title);
    minLength(schemaPath.title, 3);
    required(schemaPath.noteVisibility);
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
    await this.retros.loadMembers(workspaceId);
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
    await submit(this.retroForm, {
      action: async () => {
        const workspaceId = this.workspaces.selectedWorkspaceId();
        if (!workspaceId) {
          this.formError.set('retro.create.noWorkspace');
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
        const id = await this.retros.createRetro(workspaceId, {
          title: value.title.trim(),
          noteVisibility: value.noteVisibility,
          closePolicy: value.closePolicy,
          endsAt: toIso(value.endsAt),
          inviteUserIds: this.selectedInviteIds(),
        });
        if (id) {
          await this.router.navigate(['/app/retros', id]);
        }
        return undefined;
      },
    });
  }
}
