/**
 * Season-active classification from Sleeper NFL `season_type`.
 *
 * Single source of truth for "is the NFL/fantasy season in an active window?"
 * Values come from the same `/state/nfl` pipeline as Weekly finality
 * (`NflWeekContext.season_type` / `/api/nfl/state`).
 *
 * Active: preseason + regular season (Weekly is the high-value default).
 * Inactive: postseason, offseason, missing/unknown (prefer Receipts; never invent).
 */
export function isNflFantasySeasonActive(
  seasonType: string | null | undefined,
): boolean {
  const t = String(seasonType ?? "")
    .trim()
    .toLowerCase();
  return t === "pre" || t === "regular";
}
