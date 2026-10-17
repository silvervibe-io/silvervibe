import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PLAN_KEYS, type PlanKey } from '@silvervibe/shared/feature-flags';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from './preview-tokens';

export type PreviewWorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type PreviewTeamRole = 'ADMIN' | 'MEMBER';

export const PREVIEW_STORAGE_KEY = 'silvervibe.previewContext';
export const PREVIEW_ORG_LABEL = 'Silvervibe';
export const PREVIEW_PREFERRED_WORKSPACE_SLUG = 'silvervibe';

export const PREVIEW_WORKSPACE_ROLES: readonly PreviewWorkspaceRole[] = [
  'OWNER',
  'ADMIN',
  'MEMBER',
] as const;

export const PREVIEW_PLAN_KEYS: readonly PlanKey[] = [
  PLAN_KEYS.free,
  PLAN_KEYS.team,
] as const;

type StoredPreview = {
  workspaceRole: PreviewWorkspaceRole;
  planKey: PlanKey;
};

type PreviewState = {
  workspaceRole: PreviewWorkspaceRole;
  planKey: PlanKey;
};

const initialState: PreviewState = {
  workspaceRole: 'OWNER',
  planKey: PLAN_KEYS.free,
};

function readStored(): StoredPreview | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredPreview>;
    const workspaceRole = PREVIEW_WORKSPACE_ROLES.includes(
      parsed.workspaceRole as PreviewWorkspaceRole,
    )
      ? (parsed.workspaceRole as PreviewWorkspaceRole)
      : null;
    const planKey = PREVIEW_PLAN_KEYS.includes(parsed.planKey as PlanKey)
      ? (parsed.planKey as PlanKey)
      : null;
    if (!workspaceRole || !planKey) {
      return null;
    }
    return { workspaceRole, planKey };
  } catch {
    return null;
  }
}

function persist(state: StoredPreview): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state));
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export const PreviewContextStore = signalStore(
  { providedIn: 'root' },
  withState(() => {
    const stored = readStored();
    return stored ?? initialState;
  }),
  withComputed((store) => {
    const allowlist = inject(PREVIEW_SWITCHER_EMAILS);
    const userEmail = inject(PREVIEW_SWITCHER_USER_EMAIL, { optional: true });

    const isEligible = computed(() => {
      const email = normalizeEmail(userEmail?.() ?? null);
      if (!email || allowlist.length === 0) {
        return false;
      }
      return allowlist.some((allowed) => normalizeEmail(allowed) === email);
    });

    const isActive = computed(() => isEligible());

    const teamRole = computed<PreviewTeamRole>(() =>
      store.workspaceRole() === 'MEMBER' ? 'MEMBER' : 'ADMIN',
    );

    const isWorkspaceAdmin = computed(
      () =>
        store.workspaceRole() === 'OWNER' || store.workspaceRole() === 'ADMIN',
    );

    const isTeamAdmin = computed(() => teamRole() === 'ADMIN');

    return {
      isEligible,
      isActive,
      teamRole,
      isWorkspaceAdmin,
      isTeamAdmin,
      orgLabel: computed(() => (isActive() ? PREVIEW_ORG_LABEL : null)),
    };
  }),
  withMethods((store) => ({
    setWorkspaceRole(workspaceRole: PreviewWorkspaceRole): void {
      if (!PREVIEW_WORKSPACE_ROLES.includes(workspaceRole)) {
        return;
      }
      patchState(store, { workspaceRole });
      persist({
        workspaceRole,
        planKey: store.planKey(),
      });
    },

    setPlanKey(planKey: PlanKey): void {
      if (!PREVIEW_PLAN_KEYS.includes(planKey)) {
        return;
      }
      patchState(store, { planKey });
      persist({
        workspaceRole: store.workspaceRole(),
        planKey,
      });
    },
  })),
  withHooks({
    onInit(store) {
      const stored = readStored();
      if (stored) {
        patchState(store, stored);
      }
    },
  }),
);

export type PreviewContextStore = InstanceType<typeof PreviewContextStore>;
