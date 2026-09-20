/**
 * Canonical matchup pair classification for weekly / history pipelines.
 *
 * Completion detection is intentionally pluggable so it can grow beyond the
 * current Sleeper 0–0 shell heuristic without rewriting call sites.
 *
 * Callers must say whether a week is final before nonzero scores become W/L:
 * partial live scores must not contaminate standings.
 */

export type MatchupCompletionHeuristic = "nonzero_points";

export type MatchupSide = {
  rosterId: number;
  points: number;
};

export type MatchupClassification =
  | { status: "malformed"; reason: "missing_side" | "incomplete_pair" | "invalid_points" }
  | { status: "scheduled" }
  /** Nonzero (or otherwise "started") scores, but caller marked the week not final. */
  | { status: "in_progress"; a: MatchupSide; b: MatchupSide }
  | { status: "tie"; a: MatchupSide; b: MatchupSide }
  | { status: "completed"; winner: MatchupSide; loser: MatchupSide };

export type ClassifyMatchupOptions = {
  /**
   * How to decide a pair has started / left the unplayed shell.
   * Default: either side has points > 0 (existing Sleeper unplayed-shell heuristic).
   * Future heuristics (starters present, league status, etc.) plug in here.
   */
  completionHeuristic?: MatchupCompletionHeuristic;
  /**
   * When false, pairs that look scored are `in_progress` — never win/loss/tie.
   * Defaults to true (caller asserts the week is final). Do not infer from scores alone.
   */
  weekIsFinal?: boolean;
};

function safePoints(n: unknown): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

/**
 * Existing history heuristic: unplayed Sleeper shells are 0–0.
 * Exported so League History can share one definition.
 * This is only "has scoring activity" — not "week is final".
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

function hasScoringActivity(a: MatchupSide, b: MatchupSide, heuristic: MatchupCompletionHeuristic): boolean {
  return isCompletedMatchupPoints(a.points, b.points, heuristic);
}

/**
 * Classify a head-to-head pair. Never uses >= to pick a winner:
 * equal final scores are ties; only strict > assigns a winner.
 * Non-final weeks with scoring activity are `in_progress`.
 */
export function classifyMatchupPair(
  a: MatchupSide | null | undefined,
  b: MatchupSide | null | undefined,
  options: ClassifyMatchupOptions = {},
): MatchupClassification {
  const heuristic = options.completionHeuristic ?? "nonzero_points";
  const weekIsFinal = options.weekIsFinal !== false;

  if (!a || !b) {
    return { status: "malformed", reason: "missing_side" };
  }
  if (!Number.isFinite(a.rosterId) || !Number.isFinite(b.rosterId)) {
    return { status: "malformed", reason: "incomplete_pair" };
  }
  if (!Number.isFinite(a.points) || !Number.isFinite(b.points)) {
    return { status: "malformed", reason: "invalid_points" };
  }

  if (!hasScoringActivity(a, b, heuristic)) {
    return { status: "scheduled" };
  }

  if (!weekIsFinal) {
    return { status: "in_progress", a, b };
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

/** True when the classification is a final played game (win/loss or tie). */
export function isPlayableClassification(
  c: MatchupClassification,
): c is Extract<MatchupClassification, { status: "completed" | "tie" }> {
  return c.status === "completed" || c.status === "tie";
}

/** Scores from a final played classification (includes legitimate zeros). */
export function scoresFromPlayedClassification(c: MatchupClassification): number[] {
  if (c.status === "completed") return [c.winner.points, c.loser.points];
  if (c.status === "tie") return [c.a.points, c.b.points];
  return [];
}
