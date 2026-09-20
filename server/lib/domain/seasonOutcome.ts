/**
 * Explicit season-outcome model.
 *
 * Separates regular-season rank/seed from playoff qualification, final finish,
 * championship result, and wooden-spoon / last place. Never infers champion
 * from roster.settings.rank === 1.
 */

import {
  resolvePlayoffBrackets,
  type BracketResolution,
  type SleeperBracketRow,
} from "./playoffBracket";

export type SeasonOutcomeSourceField =
  | "standings_rebuild"
  | "winners_bracket"
  | "playoff_teams_cutoff"
  | "bracket_placement"
  | "consolation_bracket"
  | "regular_season_standings"
  | "absent";

export type SeasonOutcome = {
  season: string;
  rosterId: number;
  /** Regular-season standing (1 = best). Distinct from finalFinish. */
  regularSeasonRank?: number;
  /** Seed among playoff field when qualified. */
  playoffSeed?: number;
  playoffQualified?: boolean;
  /** Final playoff/consolation finish when known (1 = champion). */
  finalFinish?: number;
  championshipWon?: boolean;
  runnerUp?: boolean;
  lastPlace?: boolean;
  source: {
    regularSeasonRank: SeasonOutcomeSourceField;
    playoffQualified: SeasonOutcomeSourceField;
    finalFinish: SeasonOutcomeSourceField;
    championship: SeasonOutcomeSourceField;
    lastPlace: SeasonOutcomeSourceField;
    confidence: "high" | "medium" | "low" | "none";
  };
};

export type RegularSeasonStandingRow = {
  rosterId: number;
  wins: number;
  losses: number;
  ties?: number;
  pointsFor: number;
};

/**
 * Rank teams for the regular season: wins desc, losses asc, PF desc, rosterId asc.
 * Returns 1-based ranks. Does not invent ranks for empty input.
 */
export function rankRegularSeasonStandings(
  rows: RegularSeasonStandingRow[],
): Map<number, number> {
  const sorted = [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const at = a.ties ?? 0;
    const bt = b.ties ?? 0;
    if (bt !== at) return bt - at;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.rosterId - b.rosterId;
  });
  const ranks = new Map<number, number>();
  sorted.forEach((row, i) => ranks.set(row.rosterId, i + 1));
  return ranks;
}

export type BuildSeasonOutcomesInput = {
  season: string;
  rosterIds: number[];
  /** Rebuilt regular-season standings (preferred). */
  regularSeasonStandings?: RegularSeasonStandingRow[];
  playoffTeams?: number;
  winnersBracket?: SleeperBracketRow[] | null;
  /**
   * Losers/consolation bracket.
   * - `[]` = known empty (no consolation configured) → regular-season cellar fallback allowed
   * - non-empty = use consolation placements
   * - `null` / omitted = fetch unavailable → do not guess lastPlace
   */
  losersBracket?: SleeperBracketRow[] | null;
  /**
   * Explicit availability when callers need to distinguish failed fetch from empty.
   * Defaults: array → available; null/undefined → unavailable.
   */
  losersBracketStatus?: "available" | "unavailable";
  leagueSize?: number;
};

/**
 * Build per-roster SeasonOutcome for one season.
 *
 * Source priority:
 * - regularSeasonRank: standings rebuild only (never settings.rank)
 * - playoffQualified: winners-bracket participation, else playoff_teams cutoff on known ranks
 * - champion / runner-up / finalFinish: bracket placements only
 * - lastPlace: consolation when present; regular-season cellar only when losers bracket is
 *   known empty — never when the losers-bracket fetch was unavailable
 */
export function buildSeasonOutcomes(input: BuildSeasonOutcomesInput): SeasonOutcome[] {
  const {
    season,
    rosterIds,
    regularSeasonStandings,
    playoffTeams,
    winnersBracket,
    losersBracket,
    leagueSize = rosterIds.length,
  } = input;

  const regularRanks =
    regularSeasonStandings && regularSeasonStandings.length
      ? rankRegularSeasonStandings(regularSeasonStandings)
      : new Map<number, number>();

  const losersBracketStatus: "available" | "unavailable" =
    input.losersBracketStatus ??
    (Array.isArray(losersBracket) ? "available" : "unavailable");

  const losersRows = losersBracketStatus === "available" && Array.isArray(losersBracket) ? losersBracket : [];
  const bracket: BracketResolution = resolvePlayoffBrackets(winnersBracket, losersRows);
  const hasWinnersBracket = Array.isArray(winnersBracket) && winnersBracket.length > 0;
  const hasLosersBracketRows = losersBracketStatus === "available" && losersRows.length > 0;

  const outcomes: SeasonOutcome[] = [];

  for (const rosterId of rosterIds) {
    const regularSeasonRank = regularRanks.get(rosterId);

    let playoffQualified: boolean | undefined;
    let playoffQualifiedSource: SeasonOutcomeSourceField = "absent";

    if (hasWinnersBracket) {
      playoffQualified = bracket.playoffRosterIds.has(rosterId);
      playoffQualifiedSource = "winners_bracket";
    } else if (
      playoffTeams != null &&
      Number.isFinite(playoffTeams) &&
      playoffTeams > 0 &&
      regularSeasonRank != null
    ) {
      playoffQualified = regularSeasonRank <= playoffTeams;
      playoffQualifiedSource = "playoff_teams_cutoff";
    }

    let playoffSeed: number | undefined;
    if (playoffQualified === true && regularSeasonRank != null) {
      playoffSeed = regularSeasonRank;
    }

    let finalFinish = bracket.finalFinishByRosterId.get(rosterId);
    let finalFinishSource: SeasonOutcomeSourceField = finalFinish != null ? "bracket_placement" : "absent";

    let championshipWon: boolean | undefined;
    let runnerUp: boolean | undefined;
    let championshipSource: SeasonOutcomeSourceField = "absent";

    if (bracket.championshipResolved) {
      championshipWon = rosterId === bracket.championRosterId;
      runnerUp = rosterId === bracket.runnerUpRosterId;
      championshipSource = "bracket_placement";
      if (championshipWon) {
        finalFinish = 1;
        finalFinishSource = "bracket_placement";
      } else if (runnerUp) {
        finalFinish = 2;
        finalFinishSource = "bracket_placement";
      }
    }

    let lastPlace: boolean | undefined;
    let lastPlaceSource: SeasonOutcomeSourceField = "absent";

    if (hasLosersBracketRows && bracket.lastPlaceFromConsolation && bracket.lastPlaceRosterId != null) {
      lastPlace = rosterId === bracket.lastPlaceRosterId;
      lastPlaceSource = "consolation_bracket";
    } else if (
      losersBracketStatus === "available" &&
      losersRows.length === 0 &&
      regularSeasonRank != null &&
      leagueSize > 0
    ) {
      // Known empty consolation bracket — regular-season cellar is final last place.
      lastPlace = regularSeasonRank === leagueSize;
      lastPlaceSource = lastPlace ? "regular_season_standings" : "absent";
      if (lastPlace && finalFinish == null) {
        finalFinish = leagueSize;
        finalFinishSource = "regular_season_standings";
      }
    }
    // losersBracketStatus === "unavailable" → leave lastPlace unset (do not guess)

    const confidence: SeasonOutcome["source"]["confidence"] = (() => {
      if (bracket.championshipResolved && (hasWinnersBracket || hasLosersBracketRows)) return "high";
      if (hasWinnersBracket || regularRanks.size > 0) return "medium";
      if (playoffQualified != null) return "low";
      return "none";
    })();

    outcomes.push({
      season,
      rosterId,
      ...(regularSeasonRank != null ? { regularSeasonRank } : {}),
      ...(playoffSeed != null ? { playoffSeed } : {}),
      ...(playoffQualified != null ? { playoffQualified } : {}),
      ...(finalFinish != null ? { finalFinish } : {}),
      ...(championshipWon != null ? { championshipWon } : {}),
      ...(runnerUp != null ? { runnerUp } : {}),
      ...(lastPlace != null ? { lastPlace } : {}),
      source: {
        regularSeasonRank: regularSeasonRank != null ? "standings_rebuild" : "absent",
        playoffQualified: playoffQualifiedSource,
        finalFinish: finalFinishSource,
        championship: championshipSource,
        lastPlace: lastPlaceSource,
        confidence,
      },
    });
  }

  return outcomes;
}

/** Map outcomes by rosterId for convenient joins. */
export function seasonOutcomesByRosterId(outcomes: SeasonOutcome[]): Map<number, SeasonOutcome> {
  const map = new Map<number, SeasonOutcome>();
  for (const o of outcomes) map.set(o.rosterId, o);
  return map;
}

/**
 * Build the matchup map used for season-outcome standings.
 * Always covers weeks 1..regularSeasonEnd from `regularSeasonWeekMatchups`.
 * Display/filter matchups are ignored — outcomes must not depend on History filters.
 */
export function matchupsByWeekForSeasonOutcomes(params: {
  regularSeasonEnd: number;
  /** Full regular-season weeks (1..regularSeasonEnd). */
  regularSeasonWeekMatchups: Array<{
    week: number;
    matchups: Array<{ matchup_id: number | null; rosterId: number; points: number }>;
  }>;
}): Map<number, Array<{ matchup_id: number; roster_id: number; points: unknown }>> {
  const end = Math.max(1, Math.floor(params.regularSeasonEnd));
  const byWeek = new Map<number, Array<{ matchup_id: number; roster_id: number; points: unknown }>>();
  for (const weekData of params.regularSeasonWeekMatchups) {
    if (weekData.week < 1 || weekData.week > end) continue;
    const rows = weekData.matchups
      .filter((m) => m.matchup_id != null)
      .map((m) => ({
        matchup_id: m.matchup_id as number,
        roster_id: m.rosterId,
        points: m.points,
      }));
    if (rows.length) byWeek.set(weekData.week, rows);
  }
  return byWeek;
}
