/**
 * Shared helpers to classify all H2H pairs in a week of Sleeper matchup rows.
 */

import {
  classifyMatchupGroup,
  type ClassifyMatchupOptions,
  type MatchupClassification,
} from "./matchupStatus";

export type MatchupRowLike = {
  matchup_id: number;
  roster_id: number;
  points: unknown;
};

export type ClassifiedMatchupPair<T extends MatchupRowLike = MatchupRowLike> = {
  matchupId: number;
  rows: T[];
  classification: MatchupClassification;
};

/** Group rows by matchup_id and classify each group with the canonical rules. */
export function classifyWeekMatchupPairs<T extends MatchupRowLike>(
  matchups: T[],
  options: ClassifyMatchupOptions = {},
): ClassifiedMatchupPair<T>[] {
  const byMatchup = new Map<number, T[]>();
  for (const m of matchups) {
    if (m.matchup_id == null) continue;
    const list = byMatchup.get(m.matchup_id) ?? [];
    list.push(m);
    byMatchup.set(m.matchup_id, list);
  }

  const out: ClassifiedMatchupPair<T>[] = [];
  for (const [matchupId, rows] of Array.from(byMatchup.entries())) {
    out.push({
      matchupId,
      rows,
      classification: classifyMatchupGroup(rows, options),
    });
  }
  return out;
}

/** Final completed games only (strict winner). Ties / live / scheduled / malformed excluded. */
export function completedWinnerPairs<T extends MatchupRowLike>(
  pairs: ClassifiedMatchupPair<T>[],
): Array<{
  matchupId: number;
  rows: T[];
  winner: { rosterId: number; points: number };
  loser: { rosterId: number; points: number };
  margin: number;
}> {
  const out: Array<{
    matchupId: number;
    rows: T[];
    winner: { rosterId: number; points: number };
    loser: { rosterId: number; points: number };
    margin: number;
  }> = [];
  for (const pair of pairs) {
    if (pair.classification.status !== "completed") continue;
    const { winner, loser } = pair.classification;
    out.push({
      matchupId: pair.matchupId,
      rows: pair.rows,
      winner,
      loser,
      margin: winner.points - loser.points,
    });
  }
  return out;
}

/** Final played games: completed wins or ties (not live / scheduled / malformed). */
export function finalPlayedPairs<T extends MatchupRowLike>(
  pairs: ClassifiedMatchupPair<T>[],
): ClassifiedMatchupPair<T>[] {
  return pairs.filter(
    (p) => p.classification.status === "completed" || p.classification.status === "tie",
  );
}
