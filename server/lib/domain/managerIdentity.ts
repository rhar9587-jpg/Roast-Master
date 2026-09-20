/**
 * Stable manager identity for cross-season joins.
 * Prefer owner_id; never key historical aggregates by display name alone.
 */

export type ManagerIdentityInput = {
  ownerId: string | null | undefined;
  rosterId: number;
  /** Season league id — scopes roster-only fallback so slots never merge across years. */
  seasonLeagueId?: string;
  username?: string | null;
  displayName?: string | null;
};

/**
 * Canonical manager key:
 * - `owner:{ownerId}` when Sleeper owner_id is present (rename-safe, collision-safe)
 * - otherwise `roster:{seasonLeagueId}:{rosterId}` (or `roster:{rosterId}`) so
 *   identical display names never merge and owner changes on a roster slot stay separate
 */
export function canonicalManagerKey(input: ManagerIdentityInput): string {
  const ownerId = input.ownerId?.trim();
  if (ownerId) return `owner:${ownerId}`;
  const season = input.seasonLeagueId?.trim();
  if (season) return `roster:${season}:${input.rosterId}`;
  return `roster:${input.rosterId}`;
}

export function managerDisplayName(input: {
  displayName?: string | null;
  username?: string | null;
  rosterId: number;
}): string {
  return input.displayName || input.username || `Roster ${input.rosterId}`;
}
