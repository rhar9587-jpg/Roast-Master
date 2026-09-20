/**
 * Canonical matchup pair classification for weekly / history pipelines.
 *
 * Completion detection is intentionally pluggable so it can grow beyond the
 * current Sleeper 0–0 shell heuristic without rewriting call sites.
 */

export type MatchupCompletionHeuristic = "nonzero_points";

export type MatchupSide = {
  rosterId: number;
  points: number;
};

export type MatchupClassification =
  | { status: "malformed"; reason: "missing_side" | "incomplete_pair" | "invalid_points" }
  | { status: "scheduled" }
  | { status: "tie"; a: MatchupSide; b: MatchupSide }
  | { status: "completed"; winner: MatchupSide; loser: MatchupSide };

export type ClassifyMatchupOptions = {
  /**
   * How to decide a pair has been played.
   * Default: either side has points > 0 (existing Sleeper unplayed-shell heuristic).
   * Future heuristics (starters present, league status, etc.) plug in here.
   */
  completionHeuristic?: MatchupCompletionHeuristic;
};

function safePoints(n: unknown): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

/**
 * Existing history heuristic: unplayed Sleeper shells are 0–0.
 * Exported so League History can share one definition.
 */
export function isCompletedMatchupPoints(
  aPoints: number,
  bPoints: number,
  heuristic: MatchupCompletionHeuristic = "nonzero_points",
): boolean {
  if (heuristic === "nonzero_points") {
    return aPoints > 0 || bPoints > 0;
  }
  // Exhaustive placeholder for future heuristics
  return aPoints > 0 || bPoints > 0;
}

function isPairCompleted(a: MatchupSide, b: MatchupSide, heuristic: MatchupCompletionHeuristic): boolean {
  return isCompletedMatchupPoints(a.points, b.points, heuristic);
}

/**
 * Classify a head-to-head pair. Never uses >= to pick a winner:
 * equal completed scores are ties; only strict > assigns a winner.
 */
export function classifyMatchupPair(
  a: MatchupSide | null | undefined,
  b: MatchupSide | null | undefined,
  options: ClassifyMatchupOptions = {},
): MatchupClassification {
  const heuristic = options.completionHeuristic ?? "nonzero_points";

  if (!a || !b) {
    return { status: "malformed", reason: "missing_side" };
  }
  if (!Number.isFinite(a.rosterId) || !Number.isFinite(b.rosterId)) {
    return { status: "malformed", reason: "incomplete_pair" };
  }
  if (!Number.isFinite(a.points) || !Number.isFinite(b.points)) {
    return { status: "malformed", reason: "invalid_points" };
  }

  if (!isPairCompleted(a, b, heuristic)) {
    return { status: "scheduled" };
  }

  if (a.points === b.points) {
    return { status: "tie", a, b };
  }

  if (a.points > b.points) {
    return { status: "completed", winner: a, loser: b };
  }
  return { status: "completed", winner: b, loser: a };
}

/**
 * Classify a matchup_id group of raw Sleeper rows (expect exactly two rosters).
 */
export function classifyMatchupGroup(
  rows: Array<{ roster_id: number; points: unknown }>,
  options: ClassifyMatchupOptions = {},
): MatchupClassification {
  if (!rows || rows.length !== 2) {
    return { status: "malformed", reason: rows?.length ? "incomplete_pair" : "missing_side" };
  }
  const aPts = safePoints(rows[0]!.points);
  const bPts = safePoints(rows[1]!.points);
  if (aPts == null || bPts == null) {
    return { status: "malformed", reason: "invalid_points" };
  }
  return classifyMatchupPair(
    { rosterId: rows[0]!.roster_id, points: aPts },
    { rosterId: rows[1]!.roster_id, points: bPts },
    options,
  );
}

/** True when the classification is a played game (win/loss or tie). */
export function isPlayableClassification(
  c: MatchupClassification,
): c is Extract<MatchupClassification, { status: "completed" | "tie" }> {
  return c.status === "completed" || c.status === "tie";
}
