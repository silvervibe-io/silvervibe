import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_PREFERRED_WORKSPACE_SLUG,
  PreviewContextStore,
  type PreviewWorkspaceRole,
} from '@silvervibe/stores/preview';

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

function pickInitialWorkspaceId(
  memberships: WorkspaceMembershipView[],
  currentId: string | null,
  preferSilvervibe: boolean,
): string | null {
  if (currentId && memberships.some((m) => m.id === currentId)) {
    return currentId;
  }
  if (preferSilvervibe) {
    const preferred = memberships.find(
      (m) => m.slug === PREVIEW_PREFERRED_WORKSPACE_SLUG,
    );
    if (preferred) {
      return preferred.id;
    }
  }
  return memberships[0]?.id ?? null;
}

export const WorkspaceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);
    const apiBase = inject(API_BASE_URL);
    const preview = inject(PreviewContextStore);

    return {
      async loadMyWorkspaces(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const memberships = await firstValueFrom(
            http.get<WorkspaceMembershipView[]>(`${apiBase}/me/workspaces`),
          );
          const selectedWorkspaceId = pickInitialWorkspaceId(
            memberships,
            store.selectedWorkspaceId(),
            preview.isActive(),
          );
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

      effectiveWorkspaceRole(): PreviewWorkspaceRole | null {
        if (preview.isActive()) {
          return preview.workspaceRole();
        }
        const id = store.selectedWorkspaceId();
        return store.memberships().find((m) => m.id === id)?.role ?? null;
      },

      isWorkspaceAdmin(): boolean {
        if (preview.isActive()) {
          return preview.isWorkspaceAdmin();
        }
        const id = store.selectedWorkspaceId();
        const role = store.memberships().find((m) => m.id === id)?.role;
        return role === 'OWNER' || role === 'ADMIN';
      },
    };
  }),
);

export type WorkspaceStore = InstanceType<typeof WorkspaceStore>;
