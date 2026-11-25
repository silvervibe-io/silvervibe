import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';

export type PortalEntry =
  | { kind: 'stay' }
  | { kind: 'vibestandup'; workspaceId: string };

type PortalMembership = {
  id: string;
  tools: ReadonlyArray<{ toolKey: string; enabled: boolean }>;
};

const PRODUCT_TOOL_KEYS = new Set<string>([
  TOOL_KEYS.vibestandup,
  TOOL_KEYS.vibepoll,
  TOOL_KEYS.viberetro,
  TOOL_KEYS.vibefeedback,
]);

/**
 * After platform sign-in, stay on the portal so the user can pick among
 * products. Auto-enter Standup only when it is the sole enabled product on a
 * single workspace (legacy single-tool workspaces).
 */
export function resolvePortalEntry(
  memberships: readonly PortalMembership[],
): PortalEntry {
  if (memberships.length !== 1) {
    return { kind: 'stay' };
  }
  const only = memberships[0];
  const enabledProducts = only.tools.filter(
    (tool) => tool.enabled && PRODUCT_TOOL_KEYS.has(tool.toolKey),
  );
  if (
    enabledProducts.length === 1 &&
    enabledProducts[0]?.toolKey === TOOL_KEYS.vibestandup
  ) {
    return { kind: 'vibestandup', workspaceId: only.id };
  }
  return { kind: 'stay' };
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

/** Poll app URL that opens the list with the chosen workspace. */
export function vibepollReturnUrl(workspaceId?: string): string {
  const params = new URLSearchParams({ enter: '1' });
  const id = workspaceId?.trim();
  if (id) {
    params.set('workspaceId', id);
  }
  return `/app?${params.toString()}`;
}

/** Retro app URL that opens the list with the chosen workspace. */
export function viberetroReturnUrl(workspaceId?: string): string {
  const params = new URLSearchParams({ enter: '1' });
  const id = workspaceId?.trim();
  if (id) {
    params.set('workspaceId', id);
  }
  return `/app?${params.toString()}`;
}

/** Feedback app URL that opens the list with the chosen workspace. */
export function vibefeedbackReturnUrl(workspaceId?: string): string {
  const params = new URLSearchParams({ enter: '1' });
  const id = workspaceId?.trim();
  if (id) {
    params.set('workspaceId', id);
  }
  return `/app?${params.toString()}`;
}
