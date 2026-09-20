/**
 * League-history narrative hooks for weekly commissioner emails (preview + recap).
 * Joins H2H cells by stable manager keys (`owner:…` / `roster:…`), never by display name.
 */

import { handleLeagueHistoryDominance } from "../league-history/index";

/** Within-week pair identified by stable keys; names are display-only. */
export interface MatchupPair {
  /** Canonical manager key from league history (`owner:…` preferred). */
  teamAKey: string;
  teamBKey: string;
  teamAName: string;
  teamBName: string;
  /** Within-season roster ids when known. */
  teamAId?: string;
  teamBId?: string;
}

export interface MatchupToWatch {
  teamA: string;
  teamB: string;
  teamAKey: string;
  teamBKey: string;
  teamAId?: string;
  teamBId?: string;
  narrative: string;
}

export interface StoryOfTheWeek {
  narrative: string;
}

export interface LeagueHistoryNarratives {
  matchupToWatch?: MatchupToWatch;
  storyOfTheWeek?: StoryOfTheWeek;
}

type DominanceCell = {
  a: string;
  b: string;
  aName: string;
  bName: string;
  badge: string;
  record: string;
  games: number;
};

type ManagerTotal = {
  key: string;
  name: string;
  totalWins: number;
  totalScore: number;
};

/** Find H2H cell by stable manager keys (order-independent). */
export function findCellByManagerKeys(
  cells: DominanceCell[],
  keyA: string,
  keyB: string,
): DominanceCell | null {
  if (!keyA || !keyB || keyA === keyB) return null;
  for (const c of cells) {
    if ((c.a === keyA && c.b === keyB) || (c.a === keyB && c.b === keyA)) return c;
  }
  return null;
}

/**
 * Get 1–2 narrative hooks for this week's matchups from league history (H2H).
 * Prefer: nemesis > owned > rivalry > dynasty. Returns at most one matchupToWatch and one storyOfTheWeek.
 */
export async function getLeagueHistoryNarratives(
  leagueId: string,
  pairs: MatchupPair[],
): Promise<LeagueHistoryNarratives> {
  if (!pairs.length) return {};

  let cells: DominanceCell[] = [];
  let totalsByManager: ManagerTotal[] = [];

  try {
    const result = await handleLeagueHistoryDominance({
      league_id: leagueId,
      start_week: 1,
      end_week: 17,
      include_playoffs: false,
    });
    cells = (result as { cells?: DominanceCell[] }).cells ?? [];
    totalsByManager = (result as { totalsByManager?: ManagerTotal[] }).totalsByManager ?? [];
  } catch (err) {
    console.warn(
      "Weekly email narratives skipped (dominance failed):",
      leagueId,
      err instanceof Error ? err.message : String(err),
    );
    return {};
  }

  const result: LeagueHistoryNarratives = {};
  let bestPriority = -1;

  for (const pair of pairs) {
    const cell = findCellByManagerKeys(cells, pair.teamAKey, pair.teamBKey);
    if (!cell || cell.games < 2) continue;

    const badge = (cell.badge || "").toUpperCase();
    const record = cell.record || "";
    let narrative: string | null = null;
    let priority = 0;

    if (badge === "NEMESIS") {
      narrative = `${cell.aName} has never beaten ${cell.bName} (${record}).`;
      priority = 40;
    } else if (badge === "OWNED") {
      narrative = `${cell.aName} has owned ${cell.bName} (${record}).`;
      priority = 30;
    } else if (badge === "RIVAL" && cell.games >= 5) {
      narrative = `Rivalry: ${cell.aName} vs ${cell.bName} (${record} H2H).`;
      priority = 20;
    } else if (badge === "EDGE" && cell.games >= 3) {
      narrative = `${cell.aName} vs ${cell.bName} — ${record} all time.`;
      priority = 10;
    }

    if (narrative && priority > bestPriority) {
      bestPriority = priority;
      // Preserve this week's roster ids when the pair orientation matches cell keys.
      const oriented =
        pair.teamAKey === cell.a
          ? {
              teamAId: pair.teamAId,
              teamBId: pair.teamBId,
            }
          : {
              teamAId: pair.teamBId,
              teamBId: pair.teamAId,
            };
      result.matchupToWatch = {
        teamA: cell.aName,
        teamB: cell.bName,
        teamAKey: cell.a,
        teamBKey: cell.b,
        ...oriented,
        narrative,
      };
    }
  }

  // Dynasty hook — all-time H2H wins leader (not current-season standings).
  if (totalsByManager.length > 0 && !result.storyOfTheWeek) {
    const sorted = [...totalsByManager].sort((a, b) => (b.totalWins ?? 0) - (a.totalWins ?? 0));
    const dynasty = sorted[0];
    if (dynasty?.key) {
      for (const pair of pairs) {
        if (pair.teamAKey === dynasty.key || pair.teamBKey === dynasty.key) {
          const underdogName =
            pair.teamAKey === dynasty.key ? pair.teamBName : pair.teamAName;
          result.storyOfTheWeek = {
            narrative: `Can ${underdogName} take down the dynasty? ${dynasty.name} leads all-time H2H wins.`,
          };
          break;
        }
      }
    }
  }

  return result;
}
