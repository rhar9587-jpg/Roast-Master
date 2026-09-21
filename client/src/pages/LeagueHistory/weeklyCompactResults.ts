/**
 * Compact completed-week matchup results for the Weekly tab.
 */

export type WeeklyResultRow = {
  winnerName: string;
  winnerScore: number;
  loserName: string;
  loserScore: number;
  margin: number;
};

export type WeeklyMatchupLike = {
  season?: string;
  week: number;
  managerKey: string;
  opponentKey: string;
  points: number;
  opponentPoints: number;
  margin: number;
  won: boolean;
};

/**
 * Build unique completed H2H rows for a week from league weeklyMatchups.
 * Skips ties and 0–0 shells. Names resolved via managerKey map.
 */
export function buildCompactWeekResults(
  matchups: WeeklyMatchupLike[] | null | undefined,
  opts: {
    week: number;
    season?: string | null;
    nameByKey: (key: string) => string;
    recapReady: boolean;
  },
): WeeklyResultRow[] {
  if (!opts.recapReady || !matchups?.length) return [];

  const week = opts.week;
  const season = opts.season ? String(opts.season) : null;
  const seen = new Set<string>();
  const rows: WeeklyResultRow[] = [];

  for (const m of matchups) {
    if (m.week !== week) continue;
    if (season && m.season && String(m.season) !== season) continue;
    if (!m.won) continue;
    const pts = Number(m.points);
    const oppPts = Number(m.opponentPoints);
    if (!Number.isFinite(pts) || !Number.isFinite(oppPts)) continue;
    if (pts === 0 && oppPts === 0) continue;
    if (pts === oppPts) continue;

    const pairKey = [m.managerKey, m.opponentKey].sort().join("|");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    rows.push({
      winnerName: opts.nameByKey(m.managerKey),
      winnerScore: pts,
      loserName: opts.nameByKey(m.opponentKey),
      loserScore: oppPts,
      margin: Math.abs(pts - oppPts),
    });
  }

  return rows.sort((a, b) => b.margin - a.margin);
}
