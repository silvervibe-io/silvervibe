import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@silvervibe/shared/auth';

export type TeamView = {
  id: string;
  name: string;
  slug: string;
  role: 'ADMIN' | 'MEMBER';
};

export type StandupEntryView = {
  id: string;
  teamId: string;
  entryDate: string;
  status: 'DRAFT' | 'SUBMITTED';
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
};

export type StandupSummaryView = {
  id: string;
  teamId: string;
  entryDate: string;
  content: string;
};

export type StandupConfigView = {
  teamId: string;
  timezone: string;
  questionsJson: {
    yesterday?: string;
    today?: string;
    blockers?: string;
  };
};

type StandupState = {
  teams: TeamView[];
  selectedTeamId: string | null;
  entry: StandupEntryView | null;
  summary: StandupSummaryView | null;
  config: StandupConfigView | null;
  teamEntries: StandupEntryView[];
  loading: boolean;
  error: string | null;
};

const initialState: StandupState = {
  teams: [],
  selectedTeamId: null,
  entry: null,
  summary: null,
  config: null,
  teamEntries: [],
  loading: false,
  error: null,
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const StandupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);
    const apiBase = inject(API_BASE_URL);

    return {
      async loadMyTeams(workspaceId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const teams = await firstValueFrom(
            http.get<TeamView[]>(
              `${apiBase}/workspaces/${workspaceId}/teams/mine`,
            ),
          );
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
        const id = store.selectedTeamId();
        const team = store.teams().find((t) => t.id === id);
        return team?.role === 'ADMIN';
      },

      async loadToday(teamId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        const date = todayIsoDate();
        try {
          const [entry, summary, config] = await Promise.all([
            firstValueFrom(
              http.get<StandupEntryView>(
                `${apiBase}/teams/${teamId}/standups/me?date=${date}`,
              ),
            ),
            firstValueFrom(
              http.get<StandupSummaryView | null>(
                `${apiBase}/teams/${teamId}/standups/summary?date=${date}`,
              ),
            ),
            firstValueFrom(
              http.get<StandupConfigView>(
                `${apiBase}/teams/${teamId}/standup-config`,
              ),
            ),
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
        body: { yesterday: string; today: string; blockers: string },
      ): Promise<void> {
        const date = todayIsoDate();
        const entry = await firstValueFrom(
          http.put<StandupEntryView>(
            `${apiBase}/teams/${teamId}/standups/me?date=${date}`,
            { ...body, status: 'DRAFT' },
          ),
        );
        patchState(store, { entry });
      },

      async submit(
        teamId: string,
        body: { yesterday: string; today: string; blockers: string },
      ): Promise<void> {
        const date = todayIsoDate();
        const entry = await firstValueFrom(
          http.put<StandupEntryView>(
            `${apiBase}/teams/${teamId}/standups/me?date=${date}`,
            { ...body, status: 'SUBMITTED' },
          ),
        );
        patchState(store, { entry });
      },

      async loadTeamAdmin(teamId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        const date = todayIsoDate();
        try {
          const [config, teamEntries, summary] = await Promise.all([
            firstValueFrom(
              http.get<StandupConfigView>(
                `${apiBase}/teams/${teamId}/standup-config`,
              ),
            ),
            firstValueFrom(
              http.get<StandupEntryView[]>(
                `${apiBase}/teams/${teamId}/standups?date=${date}`,
              ),
            ),
            firstValueFrom(
              http.get<StandupSummaryView | null>(
                `${apiBase}/teams/${teamId}/standups/summary?date=${date}`,
              ),
            ),
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
        body: {
          timezone: string;
          questionsJson: StandupConfigView['questionsJson'];
        },
      ): Promise<void> {
        const config = await firstValueFrom(
          http.put<StandupConfigView>(
            `${apiBase}/teams/${teamId}/standup-config`,
            body,
          ),
        );
        patchState(store, { config });
      },

      async refreshSummary(teamId: string): Promise<void> {
        const date = todayIsoDate();
        const summary = await firstValueFrom(
          http.post<StandupSummaryView>(
            `${apiBase}/teams/${teamId}/standups/summary?date=${date}`,
            {},
          ),
        );
        patchState(store, { summary });
      },
    };
  }),
);

export type StandupStore = InstanceType<typeof StandupStore>;
