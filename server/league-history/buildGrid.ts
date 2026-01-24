// server/league-history/buildGrid.ts
import type { SleeperMatchup } from "./sleeper";
import { emptyCell, finalizeCell, type Cell } from "./dominance";

function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export type Manager = { roster_id: number; name: string };

export type DominanceGrid = {
  managers: Manager[]; // ordered
  matrix: Cell[][]; // [row=a][col=b]
  meta: {
    start_week: number;
    end_week: number;
    weeks_included: number[];
    total_games_counted: number;
  };
};

// Takes all weeks' matchups (flattened), computes H2H across all rosters
export function buildDominanceGrid(
  managers: Manager[],
  matchupsByWeek: { week: number; matchups: SleeperMatchup[] }[],
): DominanceGrid {
  const rosterIds = managers.map((m) => m.roster_id);

  // init matrix
  const matrix: Cell[][] = rosterIds.map((a) => rosterIds.map((b) => emptyCell(a, b)));

  const indexByRoster = new Map<number, number>();
  rosterIds.forEach((rid, idx) => indexByRoster.set(rid, idx));

  let totalGamesCounted = 0;
  const weeksIncluded: number[] = [];

  for (const wk of matchupsByWeek) {
    const rows = wk.matchups || [];
    if (!rows.length) continue;

    // group by matchup_id: each matchup should have 2 rows (A and B)
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const r of rows) {
      if (!byMatchup.has(r.matchup_id)) byMatchup.set(r.matchup_id, []);
      byMatchup.get(r.matchup_id)!.push(r);
    }

    let countedThisWeek = 0;

    const matchupEntries = Array.from(byMatchup.entries());
    for (let i = 0; i < matchupEntries.length; i++) {
      const [, pair] = matchupEntries[i]!;
      if (pair.length < 2) continue;

      // Sleeper should provide exactly 2 entries for a matchup_id.
      // If it ever gives more (rare), taking first two is OK for v1.
      const a = pair[0]!;
      const b = pair[1]!;

      const aRid = a.roster_id;
      const bRid = b.roster_id;

      const ai = indexByRoster.get(aRid);
      const bi = indexByRoster.get(bRid);
      if (ai === undefined || bi === undefined) continue;

      const aPts = safeNum(a.points);
      const bPts = safeNum(b.points);

      // update A vs B
      const cellAB = matrix[ai][bi];
      const cellBA = matrix[bi][ai];

      cellAB.games += 1;
      cellBA.games += 1;

      // PF/PA totals (for preview panel later)
      cellAB.pointsFor += aPts;
      cellAB.pointsAgainst += bPts;

      cellBA.pointsFor += bPts;
      cellBA.pointsAgainst += aPts;

      if (aPts > bPts) {
        cellAB.wins += 1;
        cellBA.losses += 1;
      } else if (aPts < bPts) {
        cellAB.losses += 1;
        cellBA.wins += 1;
      } else {
        cellAB.ties += 1;
        cellBA.ties += 1;
      }

      countedThisWeek += 1;
    }

    if (countedThisWeek > 0) {
      weeksIncluded.push(wk.week);
      totalGamesCounted += countedThisWeek;
    }
  }

  // finalize stats + badges + display strings
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i]!.length; j++) {
      const c = matrix[i]![j]!;

      // keep diagonal clean/disabled
      if (i === j) {
        // you can keep it blank in UI by checking i===j,
        // but we also zero it to avoid weird badges
        const base = { ...c, games: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
        const { badge: _badge, ...rest } = base;
        matrix[i]![j] = finalizeCell(rest);
        continue;
      }

      const { badge: _badge, ...rest } = c;
      matrix[i]![j] = finalizeCell(rest);
    }
  }

  return {
    managers,
    matrix,
    meta: {
      start_week: matchupsByWeek[0]?.week ?? 1,
      end_week: matchupsByWeek[matchupsByWeek.length - 1]?.week ?? 1,
      weeks_included: weeksIncluded,
      total_games_counted: totalGamesCounted,
    },
  };
}