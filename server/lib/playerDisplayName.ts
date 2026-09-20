/**
 * Shared Sleeper player display-name resolution.
 * Never invent user-facing `Player <id>` fallbacks.
 */

export const UNKNOWN_PLAYER_DISPLAY = "Unknown Player";

export type SleeperPlayerNameFields = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
};

/** True if a string is the banned raw-ID fallback form (`Player 6804`). */
export function looksLikeRawPlayerIdFallback(name: string): boolean {
  return /^Player\s+\S+$/i.test(String(name || "").trim());
}

export type DisplayNameOptions = {
  /** Append `(POS, TEAM)` when both are present. Default false for email lists. */
  decoratePositionTeam?: boolean;
};

/**
 * Build a user-facing player label from a Sleeper player record.
 * Returns null when no real name is available.
 */
export function displayNameFromSleeperPlayer(
  p: SleeperPlayerNameFields | null | undefined,
  opts?: DisplayNameOptions,
): string | null {
  if (!p) return null;
  const base =
    (typeof p.full_name === "string" && p.full_name.trim()) ||
    [p.first_name, p.last_name]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" ")
      .trim();
  if (!base) return null;
  if (opts?.decoratePositionTeam && p.position && p.team) {
    return `${base} (${p.position}, ${p.team})`;
  }
  return base;
}

/**
 * Resolve from a bulk players map entry only (no network).
 * Returns null when unresolved — callers may omit the line or use UNKNOWN_PLAYER_DISPLAY.
 */
export function resolvePlayerDisplayNameFromMap(
  playerId: string,
  playersById: Record<string, SleeperPlayerNameFields> | null | undefined,
  opts?: DisplayNameOptions,
): string | null {
  if (!playerId || !playersById) return null;
  return displayNameFromSleeperPlayer(playersById[playerId], opts);
}

/**
 * Pure resolution order for tests / callers with both sources in hand:
 * map entry → individual record → neutral fallback.
 * Never returns `Player <id>`.
 */
export function resolvePlayerDisplayName(options: {
  playerId: string;
  fromMap?: SleeperPlayerNameFields | null;
  fromIndividual?: SleeperPlayerNameFields | null;
  decoratePositionTeam?: boolean;
}): string {
  const opts: DisplayNameOptions = {
    decoratePositionTeam: options.decoratePositionTeam,
  };
  const fromMap = displayNameFromSleeperPlayer(options.fromMap ?? null, opts);
  if (fromMap) return fromMap;
  const fromIndividual = displayNameFromSleeperPlayer(options.fromIndividual ?? null, opts);
  if (fromIndividual) return fromIndividual;
  return UNKNOWN_PLAYER_DISPLAY;
}
