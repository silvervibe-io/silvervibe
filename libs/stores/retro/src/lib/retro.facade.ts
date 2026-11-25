import { inject, Injectable } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type { CreateRetroInput, UpsertNoteInput } from './retro.models';
import { RETRO_INITIAL_STATE } from './retro.models';
import { RetroService } from './retro.service';

export const RetroStore = signalStore(
  { providedIn: 'root' },
  withState(RETRO_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(RetroService);

    return {
      async loadMembers(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const members = await api.listMembers(workspaceId);
          patchState(store, { members, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load members',
          });
        }
      },

      async loadRetros(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const retros = await api.listRetros(workspaceId);
          patchState(store, { retros, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load retros',
          });
        }
      },

      async createRetro(
        workspaceId: string,
        input: CreateRetroInput,
      ): Promise<string | null> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.createRetro(workspaceId, input);
          patchState(store, {
            selected,
            retros: [selected, ...store.retros()],
            loading: false,
          });
          return selected.id;
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to create retro',
          });
          return null;
        }
      },

      async loadRetro(retroId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.getRetro(retroId);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load retro',
          });
        }
      },

      async addNote(retroId: string, input: UpsertNoteInput): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.addNote(retroId, input);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to add note',
          });
        }
      },

      async deleteNote(retroId: string, noteId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.deleteNote(retroId, noteId);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to delete note',
          });
        }
      },

      async close(retroId: string, summary?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.close(retroId, summary);
          patchState(store, {
            selected,
            retros: store
              .retros()
              .map((retro) =>
                retro.id === selected.id
                  ? { ...retro, status: selected.status }
                  : retro,
              ),
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to close retro',
          });
        }
      },
    };
  }),
);

@Injectable({ providedIn: 'root' })
export class RetroFacade {
  private readonly store = inject(RetroStore);

  readonly retros = this.store.retros;
  readonly selected = this.store.selected;
  readonly members = this.store.members;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMembers(workspaceId: string): Promise<void> {
    return this.store.loadMembers(workspaceId);
  }

  loadRetros(workspaceId: string): Promise<void> {
    return this.store.loadRetros(workspaceId);
  }

  createRetro(
    workspaceId: string,
    input: CreateRetroInput,
  ): Promise<string | null> {
    return this.store.createRetro(workspaceId, input);
  }

  loadRetro(retroId: string): Promise<void> {
    return this.store.loadRetro(retroId);
  }

  addNote(retroId: string, input: UpsertNoteInput): Promise<void> {
    return this.store.addNote(retroId, input);
  }

  deleteNote(retroId: string, noteId: string): Promise<void> {
    return this.store.deleteNote(retroId, noteId);
  }

  close(retroId: string, summary?: string): Promise<void> {
    return this.store.close(retroId, summary);
  }
}
