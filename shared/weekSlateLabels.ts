/**
 * Shared week-state nouns for Weekly UI, public share, OG, and clipboard.
 * Mirrors canonical WeekSlateStatus — do not invent a second finality system.
 */

export type WeekSlateStatusLabel = "final" | "live" | "upcoming" | "unavailable";

export type WeekPresentationLabel = "Recap" | "Live" | "Upcoming" | "Unavailable";

export function presentationLabelFromSlate(
  slateStatus: WeekSlateStatusLabel | string | null | undefined,
): WeekPresentationLabel {
  switch (slateStatus) {
    case "final":
      return "Recap";
    case "live":
      return "Live";
    case "upcoming":
      return "Upcoming";
    case "unavailable":
      return "Unavailable";
    default:
      return "Recap";
  }
}

export function slateStatusFromPresentation(
  label: WeekPresentationLabel | string | null | undefined,
): WeekSlateStatusLabel {
  switch (label) {
    case "Live":
      return "live";
    case "Upcoming":
      return "upcoming";
    case "Unavailable":
      return "unavailable";
    case "Recap":
    default:
      return "final";
  }
}

function clampWeek(week: number): number {
  const n = Math.floor(Number(week));
  if (!Number.isFinite(n)) return 1;
  return Math.min(18, Math.max(1, n));
}

/**
 * Week headline matching slate state.
 * - public unavailable: "Week N Results Unavailable"
 * - short unavailable: "Week N Unavailable"
 */
export function weekSlateHeadline(
  week: number,
  slateStatus: WeekSlateStatusLabel | string,
  variant: "short" | "public" = "short",
): string {
  const w = clampWeek(week);
  switch (slateStatus) {
    case "live":
      return `Week ${w} Live`;
    case "upcoming":
      return `Week ${w} Upcoming`;
    case "unavailable":
      return variant === "public" ? `Week ${w} Results Unavailable` : `Week ${w} Unavailable`;
    case "final":
    default:
      return `Week ${w} Recap`;
  }
}

export function weekPresentationHeadline(
  week: number,
  label: WeekPresentationLabel | string,
  variant: "short" | "public" = "short",
): string {
  return weekSlateHeadline(week, slateStatusFromPresentation(label), variant);
}
