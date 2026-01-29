/**
 * Week filtering utilities for dominance grid computation.
 * Extracted for testability and reuse.
 */

export type SeasonWeekRangeParams = {
  requestedStart: number;
  requestedEnd: number;
  playoffStartWeek: number;
  includePlayoffs: boolean;
};

export type SeasonWeekRange = {
  start: number;
  end: number;
};

/**
 * Computes the effective week range for a season, optionally excluding playoff weeks.
 * 
 * @param params.requestedStart - The requested start week (typically 1)
 * @param params.requestedEnd - The requested end week (typically 17)
 * @param params.playoffStartWeek - The week playoffs begin for this season
 * @param params.includePlayoffs - Whether to include playoff weeks
 * @returns The effective week range, or null if no valid weeks exist
 */
export function computeSeasonWeekRange(params: SeasonWeekRangeParams): SeasonWeekRange | null {
  const { requestedStart, requestedEnd, playoffStartWeek, includePlayoffs } = params;

  // Regular season ends the week before playoffs start
  const regularSeasonEnd = Math.max(1, playoffStartWeek - 1);

  // If including playoffs, use the requested end; otherwise clamp to regular season
  const effectiveEnd = includePlayoffs 
    ? requestedEnd 
    : Math.min(requestedEnd, regularSeasonEnd);

  // If the effective end is before the requested start, no valid weeks exist
  if (effectiveEnd < requestedStart) {
    return null;
  }

  return {
    start: requestedStart,
    end: effectiveEnd,
  };
}

/**
 * Computes the playoff start week from league settings.
 * Mirrors the logic in handleLeagueHistoryDominance.
 * 
 * @param settings - League settings object from Sleeper API
 * @returns The playoff start week (defaults to 15 if not determinable)
 */
export function getPlayoffStartWeek(settings: {
  playoff_start_week?: number;
  playoff_week_start?: number;
  playoff_week_end?: number;
} | null | undefined): number {
  if (!settings) return 15;

  // Prefer explicit playoff_start_week or playoff_week_start
  if (settings.playoff_start_week !== undefined) {
    return settings.playoff_start_week;
  }
  if (settings.playoff_week_start !== undefined) {
    return settings.playoff_week_start;
  }

  // If only end is present, assume 2-round playoffs
  if (settings.playoff_week_end !== undefined) {
    return Math.max(15, settings.playoff_week_end - 1);
  }

  // Default fallback
  return 15;
}
