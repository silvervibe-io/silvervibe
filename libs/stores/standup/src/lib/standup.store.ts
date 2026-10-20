import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PreviewContextStore } from '@silvervibe/stores/preview';
import {
  STANDUP_INITIAL_STATE,
  type StandupAnswersInput,
  type StandupConfigInput,
} from './standup.models';
import { StandupService } from './standup.service';

export const StandupStore = signalStore(
  { providedIn: 'root' },
  withState(STANDUP_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(StandupService);
    const preview = inject(PreviewContextStore);

    return {
      async loadMyTeams(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const teams = await api.listMyTeams(workspaceId);
          const selectedTeamId = store.selectedTeamId() ?? teams[0]?.id ?? null;
          patchState(store, { teams, selectedTeamId, loading: false });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load teams',
          });
        }
      },

      selectTeam(teamId: string): void {
        patchState(store, { selectedTeamId: teamId });
      },

      isTeamAdmin(): boolean {
        if (preview.isActive()) {
          return preview.isTeamAdmin();
        }
        const id = store.selectedTeamId();
        const team = store.teams().find((t) => t.id === id);
        return team?.role === 'ADMIN';
      },

      async loadToday(teamId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [entry, summary, config] = await Promise.all([
            api.getTodayEntry(teamId),
            api.getTodaySummary(teamId),
            api.getConfig(teamId),
          ]);
          patchState(store, {
            entry,
            summary,
            config,
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load standup',
          });
        }
      },

      async saveDraft(
        teamId: string,
        body: StandupAnswersInput,
      ): Promise<void> {
        const entry = await api.upsertMine(teamId, body, 'DRAFT');
        patchState(store, { entry });
      },

      async submit(teamId: string, body: StandupAnswersInput): Promise<void> {
        const entry = await api.upsertMine(teamId, body, 'SUBMITTED');
        patchState(store, { entry });
      },

      async loadTeamAdmin(teamId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [config, teamEntries, summary] = await Promise.all([
            api.getConfig(teamId),
            api.listTodayEntries(teamId),
            api.getTodaySummary(teamId),
          ]);
          patchState(store, {
            config,
            teamEntries,
            summary,
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load team admin',
          });
        }
      },

      async saveConfig(
        teamId: string,
        body: StandupConfigInput,
      ): Promise<void> {
        const config = await api.updateConfig(teamId, body);
        patchState(store, { config });
      },

      async refreshSummary(teamId: string): Promise<void> {
        const summary = await api.rebuildSummary(teamId);
        patchState(store, { summary });
      },
    };
  }),
);

export type StandupStore = InstanceType<typeof StandupStore>;
