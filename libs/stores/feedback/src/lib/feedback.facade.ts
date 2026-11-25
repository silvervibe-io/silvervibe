import { inject, Injectable } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type {
  CreateFeedbackInput,
  UpsertAnswersInput,
} from './feedback.models';
import { FEEDBACK_INITIAL_STATE } from './feedback.models';
import { FeedbackService } from './feedback.service';

export const FeedbackStore = signalStore(
  { providedIn: 'root' },
  withState(FEEDBACK_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(FeedbackService);

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

      async loadRequests(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const requests = await api.listRequests(workspaceId);
          patchState(store, { requests, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load requests',
          });
        }
      },

      async createRequest(
        workspaceId: string,
        input: CreateFeedbackInput,
      ): Promise<string | null> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.createRequest(workspaceId, input);
          patchState(store, {
            selected,
            requests: [selected, ...store.requests()],
            loading: false,
          });
          return selected.id;
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to create request',
          });
          return null;
        }
      },

      async loadRequest(requestId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.getRequest(requestId);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load request',
          });
        }
      },

      async upsertAnswers(
        requestId: string,
        input: UpsertAnswersInput,
      ): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.upsertAnswers(requestId, input);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to save answers',
          });
        }
      },

      async close(requestId: string, summary?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.close(requestId, summary);
          patchState(store, {
            selected,
            requests: store
              .requests()
              .map((request) =>
                request.id === selected.id
                  ? { ...request, status: selected.status }
                  : request,
              ),
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to close request',
          });
        }
      },
    };
  }),
);

@Injectable({ providedIn: 'root' })
export class FeedbackFacade {
  private readonly store = inject(FeedbackStore);

  readonly requests = this.store.requests;
  readonly selected = this.store.selected;
  readonly members = this.store.members;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMembers(workspaceId: string): Promise<void> {
    return this.store.loadMembers(workspaceId);
  }

  loadRequests(workspaceId: string): Promise<void> {
    return this.store.loadRequests(workspaceId);
  }

  createRequest(
    workspaceId: string,
    input: CreateFeedbackInput,
  ): Promise<string | null> {
    return this.store.createRequest(workspaceId, input);
  }

  loadRequest(requestId: string): Promise<void> {
    return this.store.loadRequest(requestId);
  }

  upsertAnswers(requestId: string, input: UpsertAnswersInput): Promise<void> {
    return this.store.upsertAnswers(requestId, input);
  }

  close(requestId: string, summary?: string): Promise<void> {
    return this.store.close(requestId, summary);
  }
}
