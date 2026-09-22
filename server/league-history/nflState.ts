/**
 * NFL week state from Sleeper — shared source for UI defaults and standings finality.
 *
 * Convention (used by /api/nfl/state + League History week picker):
 * - previewWeek = Sleeper display labeling week when present (may lag or lead week/leg)
 * - progressionWeek = authoritative current week for calendar finality (week/leg)
 * - recapWeek   = max(1, latestFinalWeek || 1)  — UI default for "last recap"
 * - latestFinalWeek = max(0, progressionWeek - 1) — last week safe to count as completed
 *   for W/L/PF/PA (0 during week 1 before any week is final)
 *
 * Finality rule: prefer Sleeper `week` / `leg` for progression so a lagging
 * `display_week` cannot hold `latestFinalWeek` back. `display_week` remains
 * available for preview/presentation only and must not be the sole driver of
 * calendar finality when week/leg are present.
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

/** Valid regular-season week number (1–18), or null if missing/invalid. */
export function asPositiveNflWeek(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const w = Math.floor(n);
  if (w < 1 || w > 18) return null;
  return w;
}

/**
 * Authoritative current NFL week for calendar finality progression.
 * Uses max(valid week, valid leg); falls back to display_week only when both absent.
 * Invalid fields never contribute.
 */
export function nflProgressionWeekFromState(state: SleeperNflStateRaw): number {
  const week = asPositiveNflWeek(state.week);
  const leg = asPositiveNflWeek(state.leg);
  const display = asPositiveNflWeek(state.display_week);
  const progressionCandidates = [week, leg].filter((v): v is number => v != null);
  if (progressionCandidates.length > 0) {
    return Math.max(...progressionCandidates);
  }
  return display ?? 1;
}

/** Derive week context from a Sleeper /state/nfl payload (pure; testable). */
export function nflWeekContextFromState(state: SleeperNflStateRaw): NflWeekContext {
  const display = asPositiveNflWeek(state.display_week);
  const week = asPositiveNflWeek(state.week);
  const leg = asPositiveNflWeek(state.leg);

  // Presentation: prefer display_week when valid (Sleeper UI labeling).
  const previewWeek = display ?? week ?? leg ?? 1;
  const progressionWeek = nflProgressionWeekFromState(state);
  const latestFinalWeek = Math.max(0, progressionWeek - 1);
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

/**
 * Shared finality resolution for roast / commissioner / wrapped / autopsy.
 *
 * When NFL state is unavailable, never invent winners — a current-season
 * live week with partial scores must stay non-final. Past seasons remain
 * final only when NFL context proves `leagueSeason < nfl.season`.
 */
export function resolveLeagueWeekFinality(
  week: number,
  leagueSeason: string | number | null | undefined,
  nfl: Pick<NflWeekContext, "season" | "latestFinalWeek"> | null | undefined,
): boolean {
  if (!nfl || nfl.season == null) return false;
  return isLeagueWeekFinal(week, leagueSeason, nfl);
}
