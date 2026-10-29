import { BadRequestException } from '@nestjs/common';

/**
 * Rebuild a team→target map via Map so user-controlled ids are never used as
 * direct property writes (CodeQL remote property injection).
 */
export function withTeamTargetEntry<T extends object>(
  existing: Record<string, T> | undefined,
  teamId: string,
  entry: T | null,
): Record<string, T> | undefined {
  const key = assertTeamTargetKey(teamId);
  const map = new Map<string, T>();
  for (const [rawKey, value] of Object.entries(existing ?? {})) {
    if (
      rawKey === '__proto__' ||
      rawKey === 'constructor' ||
      rawKey === 'prototype' ||
      !/^[a-z0-9_-]{8,64}$/i.test(rawKey)
    ) {
      continue;
    }
    map.set(rawKey, value);
  }
  if (entry === null) {
    map.delete(key);
  } else {
    map.set(key, entry);
  }
  if (map.size === 0) {
    return undefined;
  }
  return Object.fromEntries(map);
}

export function assertTeamTargetKey(teamId: string): string {
  const id = teamId.trim();
  if (!/^[a-z0-9_-]{8,64}$/i.test(id)) {
    throw new BadRequestException('Invalid team id for digest target override');
  }
  return id;
}

export function readTeamTargetEntry<T extends object>(
  teamTargets: Record<string, T> | undefined,
  teamId: string | undefined,
): T | undefined {
  if (!teamId) {
    return undefined;
  }
  try {
    const key = assertTeamTargetKey(teamId);
    return teamTargets?.[key];
  } catch {
    return undefined;
  }
}
