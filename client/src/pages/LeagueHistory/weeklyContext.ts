/**
 * Pure helpers for Weekly tab week/mode defaults and navigation.
 * Keep UI defaulting out of React so it can be unit-tested without a DOM.
 */

import { isNflFantasySeasonActive } from "@shared/nflSeasonStatus";

export type WeeklyEmailMode = "recap" | "preview";

/** In-league tab ids that participate in season-aware landing defaults. */
export type LeagueLandingMode = "history" | "weekly";

export type NflWeeklyDefaults = {
  /** 0 when no completed week exists yet (e.g. week 1 in progress). */
  latestFinalWeek: number;
  recapWeek: number;
  previewWeek: number;
};

export type WeeklyContextSelection = {
  mode: WeeklyEmailMode;
  week: number;
};

export function clampWeek(week: number): number {
  const n = Math.floor(Number(week));
  if (!Number.isFinite(n)) return 1;
  return Math.min(18, Math.max(1, n));
}

/**
 * Season-aware default tab on league entry.
 * Uses Sleeper `season_type` from the same NFL state pipeline as Weekly finality.
 * Missing/unknown season type fails closed to Receipts (history).
 */
export function resolveDefaultLandingMode(
  seasonType: string | null | undefined,
  weeklyEnabled = true,
): LeagueLandingMode {
  if (!weeklyEnabled) return "history";
  return isNflFantasySeasonActive(seasonType) ? "weekly" : "history";
}

/**
 * Apply landing default only when the user has not manually chosen a tab this session.
 * Returns null when the caller should keep the current tab.
 */
export function resolveLandingModeUnlessOverridden(
  seasonType: string | null | undefined,
  modeOverride: boolean,
  weeklyEnabled = true,
): LeagueLandingMode | null {
  if (modeOverride) return null;
  return resolveDefaultLandingMode(seasonType, weeklyEnabled);
}

/**
 * Smart default for first entry into Weekly (or when mode has no manual override).
 * Prefer latest completed week as Recap; otherwise Preview the current/upcoming week.
 * Never selects a live/future 0–0 shell as a completed recap (latestFinalWeek gates that).
 */
export function resolveDefaultWeeklyContext(nfl: NflWeeklyDefaults): WeeklyContextSelection {
  if (nfl.latestFinalWeek >= 1) {
    return { mode: "recap", week: clampWeek(nfl.latestFinalWeek) };
  }
  return { mode: "preview", week: clampWeek(nfl.previewWeek || nfl.recapWeek || 1) };
}

/**
 * Apply Weekly week/mode default only when the user has not manually overridden week.
 * Returns null when the caller should keep the current week/mode.
 */
export function resolveWeeklyContextUnlessOverridden(
  nfl: NflWeeklyDefaults,
  weekOverride: boolean,
): WeeklyContextSelection | null {
  if (weekOverride) return null;
  return resolveDefaultWeeklyContext(nfl);
}

/** When the user toggles Recap/Preview, re-apply the smart week for that mode. */
export function resolveWeekForMode(mode: WeeklyEmailMode, nfl: NflWeeklyDefaults): number {
  if (mode === "recap") {
    const week = nfl.latestFinalWeek >= 1 ? nfl.latestFinalWeek : nfl.recapWeek;
    return clampWeek(week || 1);
  }
  return clampWeek(nfl.previewWeek || 1);
}

export function navigateWeeklyWeek(week: number, delta: -1 | 1): number {
  return clampWeek(week + delta);
}

export function weeklyModeLabel(mode: WeeklyEmailMode): string {
  return mode === "recap" ? "Recap" : "Preview";
}

export function weeklyHeadline(week: number, mode: WeeklyEmailMode): string {
  return `Week ${clampWeek(week)} ${weeklyModeLabel(mode)}`;
}
