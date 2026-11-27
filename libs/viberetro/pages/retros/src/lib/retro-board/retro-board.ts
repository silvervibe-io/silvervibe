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
import { RetroFacade, type RetroNoteColumn } from '@silvervibe/stores/retro';
import { RetroShellLinks } from '../retro-shell-links';

@Component({
  selector: 'vr-retro-board',
  imports: [RouterLink, Shell, TranslocoPipe, SettingsSection, Callout],
  templateUrl: './retro-board.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class RetroBoard implements OnInit {
  private readonly retros = inject(RetroFacade);
  private readonly shellLinks = inject(RetroShellLinks);

  readonly retroId = input.required<string>();

  readonly links = this.shellLinks.links;
  readonly retro = this.retros.selected;
  readonly loading = this.retros.loading;
  readonly error = this.retros.error;

  readonly columns: RetroNoteColumn[] = ['WENT_WELL', 'IMPROVE', 'ACTIONS'];
  readonly draftColumn = signal<RetroNoteColumn>('WENT_WELL');
  readonly draftBody = signal('');
  readonly summaryDraft = signal('');

  readonly notesByColumn = computed(() => {
    const notes = this.retro()?.notes ?? [];
    return {
      WENT_WELL: notes.filter((note) => note.column === 'WENT_WELL'),
      IMPROVE: notes.filter((note) => note.column === 'IMPROVE'),
      ACTIONS: notes.filter((note) => note.column === 'ACTIONS'),
    };
  });

  async ngOnInit(): Promise<void> {
    await this.retros.loadRetro(this.retroId());
    this.summaryDraft.set(this.retro()?.summary ?? '');
  }

  async addNote(): Promise<void> {
    const body = this.draftBody().trim();
    if (!body) {
      return;
    }
    await this.retros.addNote(this.retroId(), {
      column: this.draftColumn(),
      body,
    });
    this.draftBody.set('');
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.retros.deleteNote(this.retroId(), noteId);
  }

  async closeRetro(): Promise<void> {
    await this.retros.close(this.retroId(), this.summaryDraft().trim());
  }
}
