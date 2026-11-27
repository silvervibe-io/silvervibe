import { inject, Injectable } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type { CreatePollInput } from './poll.models';
import { POLL_INITIAL_STATE } from './poll.models';
import { PollService } from './poll.service';

export const PollStore = signalStore(
  { providedIn: 'root' },
  withState(POLL_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(PollService);

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

      async loadPolls(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const polls = await api.listPolls(workspaceId);
          patchState(store, { polls, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load polls',
          });
        }
      },

      async createPoll(
        workspaceId: string,
        input: CreatePollInput,
      ): Promise<string | null> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.createPoll(workspaceId, input);
          patchState(store, {
            selected,
            polls: [selected, ...store.polls()],
            loading: false,
          });
          return selected.id;
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to create poll',
          });
          return null;
        }
      },

      async loadPoll(pollId: string): Promise<void> {
        patchState(store, { loading: true, error: null, results: null });
        try {
          const selected = await api.getPoll(pollId);
          patchState(store, { selected, loading: false });
          if (selected.canSeeResults) {
            const results = await api.results(pollId);
            patchState(store, { results });
          }
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load poll',
          });
        }
      },

      async vote(pollId: string, optionIds: string[]): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.vote(pollId, optionIds);
          const results = selected.canSeeResults
            ? await api.results(pollId)
            : null;
          patchState(store, {
            selected,
            results,
            polls: store
              .polls()
              .map((poll) =>
                poll.id === selected.id
                  ? { ...poll, hasVoted: selected.hasVoted }
                  : poll,
              ),
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to vote',
          });
        }
      },

      async close(pollId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.closePoll(pollId);
          const results = await api.results(pollId);
          patchState(store, {
            selected,
            results,
            polls: store
              .polls()
              .map((poll) =>
                poll.id === selected.id
                  ? { ...poll, status: selected.status }
                  : poll,
              ),
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to close poll',
          });
        }
      },
    };
  }),
);

@Injectable({ providedIn: 'root' })
export class PollFacade {
  private readonly store = inject(PollStore);

  readonly polls = this.store.polls;
  readonly selected = this.store.selected;
  readonly results = this.store.results;
  readonly members = this.store.members;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMembers(workspaceId: string): Promise<void> {
    return this.store.loadMembers(workspaceId);
  }

  loadPolls(workspaceId: string): Promise<void> {
    return this.store.loadPolls(workspaceId);
  }

  createPoll(
    workspaceId: string,
    input: CreatePollInput,
  ): Promise<string | null> {
    return this.store.createPoll(workspaceId, input);
  }

  loadPoll(pollId: string): Promise<void> {
    return this.store.loadPoll(pollId);
  }

  vote(pollId: string, optionIds: string[]): Promise<void> {
    return this.store.vote(pollId, optionIds);
  }

  close(pollId: string): Promise<void> {
    return this.store.close(pollId);
  }
}
