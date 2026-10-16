import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@silvervibe/shared/auth';

export type WorkspaceToolView = {
  toolKey: string;
  enabled: boolean;
};

export type WorkspaceMembershipView = {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  tools: WorkspaceToolView[];
};

type WorkspaceState = {
  memberships: WorkspaceMembershipView[];
  selectedWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: WorkspaceState = {
  memberships: [],
  selectedWorkspaceId: null,
  loading: false,
  error: null,
};

export const WorkspaceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);
    const apiBase = inject(API_BASE_URL);

    return {
      async loadMyWorkspaces(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const memberships = await firstValueFrom(
            http.get<WorkspaceMembershipView[]>(`${apiBase}/me/workspaces`),
          );
          const selectedWorkspaceId =
            store.selectedWorkspaceId() ?? memberships[0]?.id ?? null;
          patchState(store, {
            memberships,
            selectedWorkspaceId,
            loading: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            loading: false,
            error:
              err instanceof Error ? err.message : 'Failed to load workspaces',
          });
        }
      },

      selectWorkspace(workspaceId: string): void {
        patchState(store, { selectedWorkspaceId: workspaceId });
      },

      selectedWorkspace(): WorkspaceMembershipView | null {
        const id = store.selectedWorkspaceId();
        return store.memberships().find((m) => m.id === id) ?? null;
      },

      enabledTools(): WorkspaceToolView[] {
        const id = store.selectedWorkspaceId();
        const ws = store.memberships().find((m) => m.id === id);
        return (ws?.tools ?? []).filter((t) => t.enabled);
      },

      isWorkspaceAdmin(): boolean {
        const id = store.selectedWorkspaceId();
        const role = store.memberships().find((m) => m.id === id)?.role;
        return role === 'OWNER' || role === 'ADMIN';
      },
    };
  }),
);

export type WorkspaceStore = InstanceType<typeof WorkspaceStore>;
