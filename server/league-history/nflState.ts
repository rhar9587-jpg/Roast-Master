/**
 * NFL week state from Sleeper — shared source for UI defaults and standings finality.
 *
 * Convention (already used by /api/nfl/state + League History week picker):
 * - previewWeek = current display week (may be in progress)
 * - recapWeek   = max(1, previewWeek - 1)  — UI default for "last recap"
 * - latestFinalWeek = max(0, previewWeek - 1) — last week safe to count as completed
 *   for W/L/PF/PA (0 during week 1 before any week is final)
 */

import { fetchJson } from "./sleeper";

export type SleeperNflStateRaw = {
  week?: number;
  display_week?: number;
  leg?: number;
  season?: string;
  season_type?: string;
};

export type NflWeekContext = {
  season: string | null;
  season_type: string | null;
  week: number | null;
  display_week: number | null;
  leg: number | null;
  /** Current NFL week to preview (clamped 1–18). */
  previewWeek: number;
  /** UI default recap week (clamped ≥ 1). */
  recapWeek: number;
  /**
   * Last week whose matchups may contribute to standings.
   * 0 when the season's first week is still in progress.
   */
  latestFinalWeek: number;
};

/** Derive week context from a Sleeper /state/nfl payload (pure; testable). */
export function nflWeekContextFromState(state: SleeperNflStateRaw): NflWeekContext {
  const previewWeekRaw = Number(state.display_week ?? state.week ?? state.leg ?? 0);
  const previewWeek = Math.min(18, Math.max(1, previewWeekRaw || 1));
  const latestFinalWeek = Math.max(0, previewWeek - 1);
  const recapWeek = Math.max(1, latestFinalWeek || 1);

  return {
    season: state.season ?? null,
    season_type: state.season_type ?? null,
    week: state.week ?? null,
    display_week: state.display_week ?? null,
    leg: state.leg ?? null,
    previewWeek,
    recapWeek,
    latestFinalWeek,
  };
}

export async function getNflWeekContext(): Promise<NflWeekContext> {
  const state = await fetchJson<SleeperNflStateRaw>("https://api.sleeper.app/v1/state/nfl");
  return nflWeekContextFromState(state);
}

/**
 * Cap requested standings through-week at the latest NFL week confirmed complete.
 * Historical requests (throughWeek ≤ latestFinal) stay fully final.
 * Live/current-week requests do not count the in-progress week toward W/L.
 */
export function resolveFinalThroughWeek(
  throughWeek: number,
  latestFinalNflWeek: number,
): number {
  const through = Math.max(0, Math.floor(throughWeek));
  const latestFinal = Math.max(0, Math.floor(latestFinalNflWeek));
  return Math.min(through, latestFinal);
}

/**
 * Whether a specific league season+week is final for winner-dependent metrics.
 * Past seasons are fully final; current season uses latestFinalWeek.
 */
export function isLeagueWeekFinal(
  week: number,
  leagueSeason: string | number | null | undefined,
  nfl: Pick<NflWeekContext, "season" | "latestFinalWeek">,
): boolean {
  const w = Math.floor(week);
  if (!Number.isFinite(w) || w < 1) return false;
  const leagueYear = leagueSeason != null ? String(leagueSeason) : null;
  const nflYear = nfl.season != null ? String(nfl.season) : null;
  if (leagueYear && nflYear && leagueYear < nflYear) return true;
  if (leagueYear && nflYear && leagueYear > nflYear) return false;
  return w <= nfl.latestFinalWeek;
}
