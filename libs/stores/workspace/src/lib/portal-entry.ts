import { TOOL_KEYS, type ToolKey } from '@silvervibe/shared/feature-flags';

export type PortalEntry =
  | { kind: 'stay' }
  | { kind: 'product'; toolKey: ToolKey; workspaceId: string };

type PortalMembership = {
  id: string;
  tools: ReadonlyArray<{ toolKey: string; enabled: boolean }>;
};

const PRODUCT_TOOL_KEYS = new Set<string>([
  TOOL_KEYS.vibestandup,
  TOOL_KEYS.vibepoll,
  TOOL_KEYS.viberetro,
  TOOL_KEYS.vibefeedback,
  TOOL_KEYS.vibemeeting,
]);

/**
 * After platform sign-in, stay on the portal so the user can pick among
 * products — unless there is exactly one workspace with exactly one enabled
 * product tool, in which case auto-open that product.
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
  if (enabledProducts.length !== 1) {
    return { kind: 'stay' };
  }
  const toolKey = enabledProducts[0]?.toolKey;
  if (!toolKey || !PRODUCT_TOOL_KEYS.has(toolKey)) {
    return { kind: 'stay' };
  }
  return {
    kind: 'product',
    toolKey: toolKey as ToolKey,
    workspaceId: only.id,
  };
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

/** Meeting app URL that opens the list with the chosen workspace. */
export function vibemeetingReturnUrl(workspaceId?: string): string {
  const params = new URLSearchParams({ enter: '1' });
  const id = workspaceId?.trim();
  if (id) {
    params.set('workspaceId', id);
  }
  return `/app?${params.toString()}`;
}
