import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  PREVIEW_PREFERRED_WORKSPACE_SLUG,
  PreviewContextStore,
  type PreviewWorkspaceRole,
} from '@silvervibe/stores/preview';
import {
  WORKSPACE_INITIAL_STATE,
  type WorkspaceMembershipView,
  type WorkspaceToolView,
} from './workspace.models';
import { WorkspaceService } from './workspace.service';

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
  withState(WORKSPACE_INITIAL_STATE),
  withMethods((store) => {
    const api = inject(WorkspaceService);
    const preview = inject(PreviewContextStore);

    return {
      async loadMyWorkspaces(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const memberships = await api.listMyWorkspaces();
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
