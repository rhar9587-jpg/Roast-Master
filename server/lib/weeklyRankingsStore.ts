/**
 * In-memory store for last week's power rankings per league+week.
 * Used to compute trend (up/down) in the next week's email.
 * Key: leagueId:week, value: { teamId, rank }[].
 */

export type StoredRanking = { teamId: string; rank: number };

const store = new Map<string, StoredRanking[]>();

function key(leagueId: string, week: number): string {
  return `${leagueId}:${week}`;
}

/** Get stored rankings for a given league and week (e.g. week-1 for previous week). */
export function getStoredPreviousRankings(leagueId: string, forWeek: number): StoredRanking[] {
  const prevWeek = forWeek - 1;
  if (prevWeek < 1) return [];
  const k = key(leagueId, prevWeek);
  return store.get(k) ?? [];
}

/** Save rankings after generating/sending so next week can use them for trend. */
export function storeRankingsForWeek(
  leagueId: string,
  week: number,
  rankings: Array<{ teamId: string; rank: number }>,
): void {
  if (week < 1) return;
  const k = key(leagueId, week);
  store.set(k, rankings.map((r) => ({ teamId: r.teamId, rank: r.rank })));
}
