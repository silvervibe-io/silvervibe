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
  EmptyState,
  FieldHelp,
  SettingsSection,
  Shell,
  StepHeader,
} from '@silvervibe/shared/ui';
import {
  MeetingFacade,
  type MeetingClosePolicy,
  type MeetingEditPolicy,
} from '@silvervibe/stores/meeting';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { MeetingShellLinks } from '../meeting-shell-links';

type CreateMeetingModel = {
  title: string;
  context: string;
  editPolicy: MeetingEditPolicy;
  closePolicy: MeetingClosePolicy;
  scheduledAt: string;
};

@Component({
  selector: 'vm-meeting-create',
  imports: [
    FormField,
    RouterLink,
    Shell,
    TranslocoPipe,
    SettingsSection,
    FieldHelp,
    EmptyState,
    StepHeader,
  ],
  templateUrl: './meeting-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class MeetingCreate implements OnInit {
  private readonly meetingFacade = inject(MeetingFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly router = inject(Router);
  private readonly shellLinks = inject(MeetingShellLinks);

  readonly links = this.shellLinks.links;
  readonly members = this.meetingFacade.members;
  readonly loading = this.meetingFacade.loading;
  readonly error = this.meetingFacade.error;
  readonly selectedInviteIds = signal<string[]>([]);
  readonly agendaItems = signal<string[]>(['']);
  readonly formError = signal<string | null>(null);

  readonly editOptions: MeetingEditPolicy[] = [
    'CREATOR_OR_ADMIN',
    'CREATOR_ONLY',
    'ANY_INVITEE',
  ];
  readonly closeOptions: MeetingClosePolicy[] = [
    'CREATOR_OR_ADMIN',
    'CREATOR_ONLY',
    'ANY_INVITEE',
  ];

  readonly model = signal<CreateMeetingModel>({
    title: '',
    context: '',
    editPolicy: 'CREATOR_OR_ADMIN',
    closePolicy: 'CREATOR_OR_ADMIN',
    scheduledAt: '',
  });

  readonly meetingForm = form(this.model, (schemaPath) => {
    required(schemaPath.title);
    minLength(schemaPath.title, 3);
    required(schemaPath.editPolicy);
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
    await this.meetingFacade.loadMembers(workspaceId);
  }

  addAgendaItem(): void {
    this.agendaItems.set([...this.agendaItems(), '']);
  }

  updateAgendaItem(index: number, value: string): void {
    const next = [...this.agendaItems()];
    next[index] = value;
    this.agendaItems.set(next);
  }

  removeAgendaItem(index: number): void {
    if (this.agendaItems().length <= 1) {
      return;
    }
    this.agendaItems.set(this.agendaItems().filter((_, i) => i !== index));
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
    await submit(this.meetingForm, {
      action: async () => {
        const workspaceId = this.workspaces.selectedWorkspaceId();
        if (!workspaceId) {
          this.formError.set('meeting.create.noWorkspace');
          return undefined;
        }
        const cleanedAgenda = this.agendaItems()
          .map((item) => item.trim())
          .filter(Boolean);
        if (cleanedAgenda.length < 1) {
          this.formError.set('meeting.create.needAgenda');
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
        const id = await this.meetingFacade.createMeeting(workspaceId, {
          title: value.title.trim(),
          context: value.context.trim() || null,
          agendaItems: cleanedAgenda,
          editPolicy: value.editPolicy,
          closePolicy: value.closePolicy,
          scheduledAt: toIso(value.scheduledAt),
          inviteUserIds: this.selectedInviteIds(),
        });
        if (id) {
          await this.router.navigate(['/app/meetings', id]);
        }
        return undefined;
      },
    });
  }
}
