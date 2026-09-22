/**
 * Shared power-ranking movement — one source for email, Weekly, and public recap.
 * Places = |previousRank - currentRank|; lower rank number is better.
 */

export type RankMovementState = "up" | "down" | "same" | "none";

export type RankMovement = {
  state: RankMovementState;
  /** Absolute places moved when up/down; 0 when same; null when none. */
  places: number | null;
  previousRank: number | null;
  /** Legacy direction used by older DTOs. */
  trend: "up" | "down" | "flat";
};

export function resolveRankMovement(
  currentRank: number,
  previousRank: number | null | undefined,
): RankMovement {
  const cur = Math.floor(Number(currentRank));
  const prevRaw = previousRank == null ? NaN : Number(previousRank);
  if (!Number.isFinite(cur) || cur < 1 || !Number.isFinite(prevRaw) || prevRaw < 1) {
    return { state: "none", places: null, previousRank: null, trend: "flat" };
  }
  const prev = Math.floor(prevRaw);
  if (cur < prev) {
    return { state: "up", places: prev - cur, previousRank: prev, trend: "up" };
  }
  if (cur > prev) {
    return { state: "down", places: cur - prev, previousRank: prev, trend: "down" };
  }
  return { state: "same", places: 0, previousRank: prev, trend: "flat" };
}

/**
 * Human label for movement cells.
 * - up 2 → "↑ 2"
 * - down 2 → "↓ 2"
 * - unchanged with prior → "Same"
 * - no prior → "" (suppress; do not imply history)
 */
export function formatRankMovementLabel(m: Pick<RankMovement, "state" | "places">): string {
  if (m.state === "up" && m.places != null && m.places > 0) return `↑ ${m.places}`;
  if (m.state === "down" && m.places != null && m.places > 0) return `↓ ${m.places}`;
  if (m.state === "same") return "Same";
  return "";
}

export function rankMovementVisible(m: Pick<RankMovement, "state">): boolean {
  return m.state !== "none";
}

/** Build movement from a prior-rank map (shared by generatePowerRankings consumers). */
export function resolveRankMovementFromPrior(
  teamId: string,
  currentRank: number,
  previousRankings: Array<{ teamId: string; rank: number }> | null | undefined,
): RankMovement {
  if (!previousRankings?.length) {
    return resolveRankMovement(currentRank, null);
  }
  const prev = previousRankings.find((r) => r.teamId === teamId);
  return resolveRankMovement(currentRank, prev?.rank ?? null);
}
