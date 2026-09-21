/**
 * Canonical fantasy-season completion for final-placement / end-of-season language.
 * Same rules as Weekly finality: NFL context + league playoff end — not standings alone.
 */

export type SeasonCompleteLeague = {
  season?: string | null;
  settings?: { playoff_week_end?: number } | null;
} | null | undefined;

export type SeasonCompleteNfl = {
  season?: string | null;
  season_type?: string | null;
  latestFinalWeek?: number;
} | null | undefined;

/** Prefer the newest year when history returns a range like "2019–2025". */
export function primaryLeagueSeasonYear(season: string | null | undefined): string | null {
  if (season == null) return null;
  const parts = String(season)
    .split(/[–-]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : null;
}

/**
 * Whether a fantasy league season is complete enough for final-placement language.
 */
export function isFantasySeasonComplete(
  league: SeasonCompleteLeague,
  nfl: SeasonCompleteNfl,
): boolean {
  if (!nfl || nfl.season == null) return false;
  const leagueYear = primaryLeagueSeasonYear(league?.season ?? null);
  const nflYear = String(nfl.season);
  if (leagueYear && leagueYear < nflYear) return true;
  if (leagueYear && leagueYear > nflYear) return false;
  const seasonType = String(nfl.season_type ?? "")
    .trim()
    .toLowerCase();
  if (seasonType === "post" || seasonType === "off") return true;
  const playoffEnd = Math.max(1, Number(league?.settings?.playoff_week_end) || 17);
  const latestFinal = Math.max(0, Number(nfl.latestFinalWeek) || 0);
  return latestFinal >= playoffEnd;
}
