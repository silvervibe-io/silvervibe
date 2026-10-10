/**
 * Pure helpers for workspace tool entitlements (`workspace_tools`).
 * Ownership lives in Neon; OpenFeature flags only control rollout.
 */

export type EntitlementRow = {
  toolKey: string;
  enabled: boolean;
};

export function isToolEnabled(
  enabledKeys: readonly string[],
  toolKey: string,
): boolean {
  return enabledKeys.includes(toolKey);
}

/** Enabled tool keys from Prisma (or similar) entitlement rows. */
export function enabledToolKeys(rows: readonly EntitlementRow[]): string[] {
  return rows.filter((row) => row.enabled).map((row) => row.toolKey);
}
