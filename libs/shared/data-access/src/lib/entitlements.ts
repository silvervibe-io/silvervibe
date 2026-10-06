export type EntitlementCheck = {
  workspaceId: string;
  toolKey: string;
};

export function isToolEnabled(
  enabledKeys: readonly string[],
  toolKey: string,
): boolean {
  return enabledKeys.includes(toolKey);
}
