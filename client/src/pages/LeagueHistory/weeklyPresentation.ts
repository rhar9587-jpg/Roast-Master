/**
 * Weekly tab presentation contracts — order + supporting-moment density.
 * Presentation only; does not alter roast engine, scoring, or finality.
 */

/** Completed-week section order inside the Weekly payoff (RoastCard + surrounding chrome). */
export const WEEKLY_COMPLETED_SECTION_ORDER = [
  "week-context",
  "hero",
  "share-weekly-recap",
  "compact-results",
  "power-rankings",
  "supporting-moments",
  "see-more-roasts",
  "email-tools",
  "advanced-controls",
] as const;

export type WeeklyCompletedSectionId = (typeof WEEKLY_COMPLETED_SECTION_ORDER)[number];

/** Default supporting moments shown before "See more". */
export const WEEKLY_SUPPORTING_MOMENT_LIMIT = 3;

/** Supporting moments are compact by default (not full poster cards). */
export const WEEKLY_SUPPORTING_DEFAULT_PRESENTATION = "compact" as const;

/**
 * Index helpers for hierarchy tests — Share weekly recap must precede supporting moments.
 */
export function weeklySectionIndex(id: WeeklyCompletedSectionId): number {
  return WEEKLY_COMPLETED_SECTION_ORDER.indexOf(id);
}

export function primaryShareAppearsBeforeSupporting(): boolean {
  return (
    weeklySectionIndex("share-weekly-recap") < weeklySectionIndex("supporting-moments")
  );
}

export function compactResultsAppearBeforeSupporting(): boolean {
  return (
    weeklySectionIndex("compact-results") < weeklySectionIndex("supporting-moments")
  );
}

export function emailToolsAreSecondary(): boolean {
  return (
    weeklySectionIndex("email-tools") >
    weeklySectionIndex("supporting-moments")
  );
}
