import { inject, Injectable } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type {
  CreateMeetingInput,
  SetActionsInput,
  SetDecisionsInput,
} from './meeting.models';
import { MEETING_INITIAL_STATE } from './meeting.models';
import { MeetingService } from './meeting.service';

export const MeetingStore = signalStore(
  { providedIn: 'root' },
  withState(MEETING_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(MeetingService);

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

      async loadMeetings(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const meetings = await api.listMeetings(workspaceId);
          patchState(store, { meetings, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load meetings',
          });
        }
      },

      async createMeeting(
        workspaceId: string,
        input: CreateMeetingInput,
      ): Promise<string | null> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.createMeeting(workspaceId, input);
          patchState(store, {
            selected,
            meetings: [selected, ...store.meetings()],
            loading: false,
          });
          return selected.id;
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to create meeting',
          });
          return null;
        }
      },

      async loadMeeting(meetingId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.getMeeting(meetingId);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load meeting',
          });
        }
      },

      async setDecisions(
        meetingId: string,
        input: SetDecisionsInput,
      ): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.setDecisions(meetingId, input);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to save decisions',
          });
        }
      },

      async setActions(
        meetingId: string,
        input: SetActionsInput,
      ): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.setActions(meetingId, input);
          patchState(store, { selected, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to save actions',
          });
        }
      },

      async close(meetingId: string, recap?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const selected = await api.close(meetingId, recap);
          patchState(store, {
            selected,
            meetings: store
              .meetings()
              .map((meeting) =>
                meeting.id === selected.id
                  ? { ...meeting, status: selected.status }
                  : meeting,
              ),
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to close meeting',
          });
        }
      },
    };
  }),
);

@Injectable({ providedIn: 'root' })
export class MeetingFacade {
  private readonly store = inject(MeetingStore);

  readonly meetings = this.store.meetings;
  readonly selected = this.store.selected;
  readonly members = this.store.members;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMembers(workspaceId: string): Promise<void> {
    return this.store.loadMembers(workspaceId);
  }

  loadMeetings(workspaceId: string): Promise<void> {
    return this.store.loadMeetings(workspaceId);
  }

  createMeeting(
    workspaceId: string,
    input: CreateMeetingInput,
  ): Promise<string | null> {
    return this.store.createMeeting(workspaceId, input);
  }

  loadMeeting(meetingId: string): Promise<void> {
    return this.store.loadMeeting(meetingId);
  }

  setDecisions(meetingId: string, input: SetDecisionsInput): Promise<void> {
    return this.store.setDecisions(meetingId, input);
  }

  setActions(meetingId: string, input: SetActionsInput): Promise<void> {
    return this.store.setActions(meetingId, input);
  }

  close(meetingId: string, recap?: string): Promise<void> {
    return this.store.close(meetingId, recap);
  }
}
