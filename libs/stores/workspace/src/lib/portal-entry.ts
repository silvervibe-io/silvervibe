import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';

export type PortalEntry =
  | { kind: 'stay' }
  | { kind: 'vibestandup'; workspaceId: string };

type PortalMembership = {
  id: string;
  tools: ReadonlyArray<{ toolKey: string; enabled: boolean }>;
};

/**
 * After sign-in, leave the portal only when there is a single workspace
 * entitled to VibeStandup. Several workspaces, none, or a workspace without
 * that tool stay on the portal so the user can choose or create one.
 */
export function resolvePortalEntry(
  memberships: readonly PortalMembership[],
): PortalEntry {
  if (memberships.length !== 1) {
    return { kind: 'stay' };
  }
  const only = memberships[0];
  const enabled = only.tools.some(
    (tool) => tool.enabled && tool.toolKey === TOOL_KEYS.vibestandup,
  );
  if (!enabled) {
    return { kind: 'stay' };
  }
  return { kind: 'vibestandup', workspaceId: only.id };
}

/** Standup URL that runs the one-shot role home, keeping the chosen workspace. */
export function vibestandupReturnUrl(workspaceId?: string): string {
  const params = new URLSearchParams({ enter: '1' });
  const id = workspaceId?.trim();
  if (id) {
    params.set('workspaceId', id);
  }
  return `/app?${params.toString()}`;
}
