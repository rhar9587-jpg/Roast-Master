/**
 * Winner-dependent weekly metrics built only from canonical completed classifications.
 * Ties, live/in-progress, scheduled shells, and malformed pairs never produce a winner.
 */

import {
  classifyWeekMatchupPairs,
  completedWinnerPairs,
  finalPlayedPairs,
  type MatchupRowLike,
} from "./classifyWeekMatchups";
import type { ClassifyMatchupOptions } from "./matchupStatus";

export type MarginWinnerPick = {
  winnerRosterId: number;
  loserRosterId: number;
  winnerPoints: number;
  loserPoints: number;
  margin: number;
};

/** Smallest-margin completed win (villain). Ignores ties and non-final games. */
export function pickSmallestMarginWinner(
  matchups: MatchupRowLike[],
  options: ClassifyMatchupOptions = {},
): MarginWinnerPick | null {
  const completed = completedWinnerPairs(classifyWeekMatchupPairs(matchups, options));
  let best: MarginWinnerPick | null = null;
  for (const g of completed) {
    if (!best || g.margin < best.margin) {
      best = {
        winnerRosterId: g.winner.rosterId,
        loserRosterId: g.loser.rosterId,
        winnerPoints: g.winner.points,
        loserPoints: g.loser.points,
        margin: g.margin,
      };
    }
  }
  return best;
}

/** Largest-margin completed win (blowout). Ignores ties and non-final games. */
export function pickLargestMarginWinner(
  matchups: MatchupRowLike[],
  options: ClassifyMatchupOptions = {},
): MarginWinnerPick | null {
  const completed = completedWinnerPairs(classifyWeekMatchupPairs(matchups, options));
  let best: MarginWinnerPick | null = null;
  for (const g of completed) {
    if (!best || g.margin > best.margin) {
      best = {
        winnerRosterId: g.winner.rosterId,
        loserRosterId: g.loser.rosterId,
        winnerPoints: g.winner.points,
        loserPoints: g.loser.points,
        margin: g.margin,
      };
    }
  }
  return best;
}

export type StoleRobbedPick = {
  stoleOne: {
    teamRosterId: number;
    points: number;
    opponentRosterId: number;
    opponentPoints: number;
  };
  gotRobbed: {
    teamRosterId: number;
    points: number;
    opponentRosterId: number;
    opponentPoints: number;
  };
} | null;

/**
 * Stole one = lowest winning score among completed wins.
 * Got robbed = highest losing score among completed losses.
 * Ties / live / shells skipped.
 */
export function pickStoleOneAndGotRobbed(
  matchups: MatchupRowLike[],
  options: ClassifyMatchupOptions = {},
): StoleRobbedPick {
  const completed = completedWinnerPairs(classifyWeekMatchupPairs(matchups, options));
  if (!completed.length) return null;

  let stole = completed[0]!;
  let robbed = completed[0]!;
  for (const g of completed) {
    if (g.winner.points < stole.winner.points) stole = g;
    if (g.loser.points > robbed.loser.points) robbed = g;
  }

  return {
    stoleOne: {
      teamRosterId: stole.winner.rosterId,
      points: stole.winner.points,
      opponentRosterId: stole.loser.rosterId,
      opponentPoints: stole.loser.points,
    },
    gotRobbed: {
      teamRosterId: robbed.loser.rosterId,
      points: robbed.loser.points,
      opponentRosterId: robbed.winner.rosterId,
      opponentPoints: robbed.winner.points,
    },
  };
}

/** Closest final played game (completed or tie). Live/shells excluded. */
export function pickClosestFinalGame(
  matchups: MatchupRowLike[],
  options: ClassifyMatchupOptions = {},
): { rosterIdA: number; pointsA: number; rosterIdB: number; pointsB: number; margin: number } | null {
  const played = finalPlayedPairs(classifyWeekMatchupPairs(matchups, options));
  let best: {
    rosterIdA: number;
    pointsA: number;
    rosterIdB: number;
    pointsB: number;
    margin: number;
  } | null = null;

  for (const pair of played) {
    const c = pair.classification;
    let a: { rosterId: number; points: number };
    let b: { rosterId: number; points: number };
    if (c.status === "completed") {
      a = c.winner;
      b = c.loser;
    } else if (c.status === "tie") {
      a = c.a;
      b = c.b;
    } else {
      continue;
    }
    const margin = Math.abs(a.points - b.points);
    if (!best || margin < best.margin) {
      best = {
        rosterIdA: a.rosterId,
        pointsA: a.points,
        rosterIdB: b.rosterId,
        pointsB: b.points,
        margin,
      };
    }
  }
  return best;
}

/**
 * Cross-feature truth for a single pair under a finality context.
 * Used by invariant tests across roast / commissioner / autopsy.
 */
export function matchupFinalityTruth(
  a: { roster_id: number; points: unknown },
  b: { roster_id: number; points: unknown } | null | undefined,
  options: ClassifyMatchupOptions = {},
): { hasWinner: boolean; isTie: boolean; hasNoFinalResult: boolean; winnerRosterId?: number } {
  const rows = b
    ? [
        { matchup_id: 1, roster_id: a.roster_id, points: a.points },
        { matchup_id: 1, roster_id: b.roster_id, points: b.points },
      ]
    : [{ matchup_id: 1, roster_id: a.roster_id, points: a.points }];
  const [pair] = classifyWeekMatchupPairs(rows, options);
  const c = pair?.classification;
  if (!c) return { hasWinner: false, isTie: false, hasNoFinalResult: true };
  if (c.status === "completed") {
    return {
      hasWinner: true,
      isTie: false,
      hasNoFinalResult: false,
      winnerRosterId: c.winner.rosterId,
    };
  }
  if (c.status === "tie") {
    return { hasWinner: false, isTie: true, hasNoFinalResult: false };
  }
  return { hasWinner: false, isTie: false, hasNoFinalResult: true };
}

/** Personal matchup result for roast UI — never invents a final W/L on live/shells. */
export function personalMatchupResult(
  yourRosterId: number,
  a: { roster_id: number; points: unknown },
  b: { roster_id: number; points: unknown } | null | undefined,
  options: ClassifyMatchupOptions = {},
): "WIN" | "LOSS" | "TIE" | "PENDING" {
  const truth = matchupFinalityTruth(a, b, options);
  if (truth.isTie) return "TIE";
  if (truth.hasWinner && truth.winnerRosterId != null) {
    return truth.winnerRosterId === yourRosterId ? "WIN" : "LOSS";
  }
  return "PENDING";
}

/**
 * Fraud / lucky-win watch from completed matchups only.
 * Lucky = below-median winning score; robbed = above-median losing score.
 */
export function pickFraudWatchPair(
  matchups: MatchupRowLike[],
  medianScore: number,
  options: ClassifyMatchupOptions = {},
): {
  kind: "lucky_win" | "robbed";
  winnerRosterId: number;
  loserRosterId: number;
  winnerPoints: number;
  loserPoints: number;
} | null {
  const completed = completedWinnerPairs(classifyWeekMatchupPairs(matchups, options));
  let bestLucky: {
    drama: number;
    winnerRosterId: number;
    loserRosterId: number;
    winnerPoints: number;
    loserPoints: number;
  } | null = null;
  let bestRobbed: {
    drama: number;
    winnerRosterId: number;
    loserRosterId: number;
    winnerPoints: number;
    loserPoints: number;
  } | null = null;

  for (const g of completed) {
    if (g.winner.points < medianScore) {
      const drama = medianScore - g.winner.points;
      if (!bestLucky || drama > bestLucky.drama) {
        bestLucky = {
          drama,
          winnerRosterId: g.winner.rosterId,
          loserRosterId: g.loser.rosterId,
          winnerPoints: g.winner.points,
          loserPoints: g.loser.points,
        };
      }
    }
    if (g.loser.points > medianScore) {
      const drama = g.loser.points - medianScore;
      if (!bestRobbed || drama > bestRobbed.drama) {
        bestRobbed = {
          drama,
          winnerRosterId: g.winner.rosterId,
          loserRosterId: g.loser.rosterId,
          winnerPoints: g.winner.points,
          loserPoints: g.loser.points,
        };
      }
    }
  }

  if (!bestLucky && !bestRobbed) return null;
  const useLucky = bestLucky && (!bestRobbed || bestLucky.drama >= bestRobbed.drama * 0.9);
  const best = useLucky ? bestLucky! : bestRobbed!;
  return {
    kind: useLucky ? "lucky_win" : "robbed",
    winnerRosterId: best.winnerRosterId,
    loserRosterId: best.loserRosterId,
    winnerPoints: best.winnerPoints,
    loserPoints: best.loserPoints,
  };
}
