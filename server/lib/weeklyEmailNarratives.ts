/**
 * League-history narrative hooks for weekly commissioner emails (preview + recap).
 * Calls dominance API and maps this week's matchup pairs to H2H cells for nemesis/owned/rivalry/dynasty.
 */

import { handleLeagueHistoryDominance } from "../league-history/index";

export interface MatchupPair {
  teamA: string;
  teamB: string;
}

export interface MatchupToWatch {
  teamA: string;
  teamB: string;
  narrative: string;
}

export interface StoryOfTheWeek {
  narrative: string;
}

export interface LeagueHistoryNarratives {
  matchupToWatch?: MatchupToWatch;
  storyOfTheWeek?: StoryOfTheWeek;
}

export type NarrativeEmailMode = "recap" | "preview";

function norm(name: string): string {
  return String(name ?? "").trim().toLowerCase();
}

function findCell(
  cells: Array<{ aName: string; bName: string; badge: string; record: string; games: number }>,
  teamA: string,
  teamB: string,
): { aName: string; bName: string; badge: string; record: string; games: number } | null {
  const nA = norm(teamA);
  const nB = norm(teamB);
  for (const c of cells) {
    const ca = norm(c.aName);
    const cb = norm(c.bName);
    if ((ca === nA && cb === nB) || (ca === nB && cb === nA)) return c;
  }
  return null;
}

/**
 * Get 1–2 narrative hooks for this week's matchups from league history (H2H).
 * Prefer: nemesis > owned > rivalry > dynasty. Returns at most one matchupToWatch and one storyOfTheWeek.
 * Dynasty copy is tense-aware: preview looks ahead; recap looks back.
 */
export async function getLeagueHistoryNarratives(
  leagueId: string,
  pairs: MatchupPair[],
  mode: NarrativeEmailMode = "preview",
): Promise<LeagueHistoryNarratives> {
  if (!pairs.length) return {};

  let cells: Array<{ aName: string; bName: string; badge: string; record: string; games: number }>;
  let totalsByManager: Array<{ name: string; totalWins: number; totalScore: number }>;

  try {
    const result = await handleLeagueHistoryDominance({
      league_id: leagueId,
      start_week: 1,
      end_week: 17,
      include_playoffs: false,
    });
    cells = (result as any).cells ?? [];
    totalsByManager = (result as any).totalsByManager ?? [];
  } catch (err) {
    console.warn("Weekly email narratives skipped (dominance failed):", leagueId, err instanceof Error ? err.message : String(err));
    return {};
  }

  const result: LeagueHistoryNarratives = {};
  let bestPriority = -1;

  for (const { teamA, teamB } of pairs) {
    const cell = findCell(cells, teamA, teamB);
    if (!cell || cell.games < 2) continue;

    const badge = (cell.badge || "").toUpperCase();
    const record = cell.record || "";
    let narrative: string | null = null;
    let priority = 0;

    if (badge === "NEMESIS") {
      // Cell row (aName) is the victim: has never beaten opponent (bName).
      narrative =
        mode === "recap"
          ? `${cell.aName} entered the week never having beaten ${cell.bName} (${record}).`
          : `${cell.aName} has never beaten ${cell.bName} (${record}).`;
      priority = 40;
    } else if (badge === "OWNED") {
      // Cell row (aName) owns opponent (bName).
      narrative =
        mode === "recap"
          ? `${cell.aName} has owned ${cell.bName} historically (${record}).`
          : `${cell.aName} has owned ${cell.bName} (${record}).`;
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
      result.matchupToWatch = { teamA: cell.aName, teamB: cell.bName, narrative };
    }
  }

  // Optional: dynasty hook — top team by totalWins in a matchup this week
  // Skip if matchupToWatch already involves the dynasty (avoid double-up)
  if (totalsByManager.length > 0 && !result.storyOfTheWeek) {
    const sorted = [...totalsByManager].sort((a, b) => (b.totalWins ?? 0) - (a.totalWins ?? 0));
    const dynastyName = sorted[0]?.name;
    if (dynastyName) {
      const dynastyNorm = norm(dynastyName);
      const watchTouchesDynasty =
        result.matchupToWatch &&
        (norm(result.matchupToWatch.teamA) === dynastyNorm ||
          norm(result.matchupToWatch.teamB) === dynastyNorm);

      if (!watchTouchesDynasty) {
        for (const { teamA, teamB } of pairs) {
          const aNorm = norm(teamA);
          const bNorm = norm(teamB);
          if (aNorm === dynastyNorm || bNorm === dynastyNorm) {
            const underdog = aNorm === dynastyNorm ? teamB : teamA;
            result.storyOfTheWeek = {
              narrative:
                mode === "recap"
                  ? `${underdog} drew the dynasty this week — ${dynastyName} still leads the league in wins.`
                  : `Can ${underdog} take down the dynasty? ${dynastyName} leads the league in wins.`,
            };
            break;
          }
        }
      }
    }
  }

  return result;
}
