/**
 * Week slate readiness — whether completed-tense recap language is allowed.
 *
 * Calendar finality (`resolveLeagueWeekFinality`) alone is not enough:
 * a week can be "past" on the NFL calendar while every league matchup is still
 * a 0–0 shell (or missing). Those weeks must not crown winners or say "Recap is ready".
 */

import {
  classifyWeekMatchupPairs,
  type MatchupRowLike,
} from "./classifyWeekMatchups";

export type WeekSlateStatus = "final" | "live" | "upcoming" | "unavailable";

export type WeekSlateResolution = {
  status: WeekSlateStatus;
  weekIsFinal: boolean;
  /** At least one pair finished as completed or tie under canonical classification. */
  hasFinalPlayedGames: boolean;
  /** At least one pair is live/in_progress. */
  hasLiveScoring: boolean;
  pairCount: number;
};

/**
 * Resolve slate status from calendar finality + canonical matchup classifications.
 * Never treats nonzero alone or matchup-row presence alone as completed.
 */
export function resolveWeekSlateStatus(params: {
  weekIsFinal: boolean;
  matchups: MatchupRowLike[] | null | undefined;
}): WeekSlateResolution {
  const weekIsFinal = params.weekIsFinal === true;
  const matchups = params.matchups ?? [];
  if (!matchups.length) {
    return {
      status: "unavailable",
      weekIsFinal,
      hasFinalPlayedGames: false,
      hasLiveScoring: false,
      pairCount: 0,
    };
  }

  const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal });
  let hasFinalPlayedGames = false;
  let hasLiveScoring = false;
  for (const pair of pairs) {
    const s = pair.classification.status;
    if (s === "completed" || s === "tie") hasFinalPlayedGames = true;
    if (s === "in_progress") hasLiveScoring = true;
  }

  let status: WeekSlateStatus;
  if (weekIsFinal && hasFinalPlayedGames) {
    status = "final";
  } else if (!weekIsFinal && hasLiveScoring) {
    status = "live";
  } else if (!weekIsFinal && !hasFinalPlayedGames) {
    // Non-final week with only 0–0 shells (or malformed) — upcoming/pre-kickoff.
    status = hasLiveScoring ? "live" : "upcoming";
  } else {
    // Calendar final but no played scores yet (all 0–0 / delayed scoring).
    status = "unavailable";
  }

  return {
    status,
    weekIsFinal,
    hasFinalPlayedGames,
    hasLiveScoring,
    pairCount: pairs.length,
  };
}

/** Completed-tense recap / Top Dog / "Recap is ready" only when status is final. */
export function isWeekSlateRecapReady(status: WeekSlateStatus): boolean {
  return status === "final";
}
