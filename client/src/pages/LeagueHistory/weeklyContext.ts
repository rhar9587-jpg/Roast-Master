import {
  weekPresentationHeadline,
  type WeekPresentationLabel,
} from "@shared/weekSlateLabels";

/**
 * Pure helpers for Weekly tab week/mode defaults and navigation.
 * Keep UI defaulting out of React so it can be unit-tested without a DOM.
 */

export type WeeklyEmailMode = "recap" | "preview";

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
 * Smart default for first entry into Weekly (or when mode has no manual override).
 * Prefer latest completed week as Recap; otherwise Preview the current/upcoming week.
 */
export function resolveDefaultWeeklyContext(nfl: NflWeeklyDefaults): WeeklyContextSelection {
  if (nfl.latestFinalWeek >= 1) {
    return { mode: "recap", week: clampWeek(nfl.latestFinalWeek) };
  }
  return { mode: "preview", week: clampWeek(nfl.previewWeek || nfl.recapWeek || 1) };
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
  // Avoid ambiguous "Preview" (also used for email). Upcoming = matchup preview mode.
  return mode === "recap" ? "Recap" : "Upcoming";
}

/** Presentation state for a selected week relative to NFL latestFinalWeek + roast signals. */
export type WeeklyWeekPresentation = {
  label: WeekPresentationLabel;
  supportingLine: string;
  /** Commissioner bridge must not say "Recap is ready" when false. */
  recapReady: boolean;
};

/**
 * Mode-based headline (Recap/Preview toggle). Prefer weeklyPresentationHeadline when
 * slate presentation is available so non-final weeks never say "Recap".
 */
export function weeklyHeadline(week: number, mode: WeeklyEmailMode): string {
  return `Week ${clampWeek(week)} ${weeklyModeLabel(mode)}`;
}

/** Slate-aware headline — never "Recap" for non-final weeks. */
export function weeklyPresentationHeadline(
  week: number,
  presentation: Pick<WeeklyWeekPresentation, "label"> | WeekPresentationLabel,
): string {
  const label =
    typeof presentation === "string" ? presentation : presentation.label;
  return weekPresentationHeadline(week, label, "short");
}

/**
 * Resolve how the Weekly UI should describe the selected week.
 * Prefer server `slateStatus` / `recapReady` when present; otherwise use calendar finality.
 */
export function resolveWeeklyWeekPresentation(params: {
  week: number;
  mode: WeeklyEmailMode;
  latestFinalWeek: number;
  slateStatus?: string | null;
  recapReady?: boolean | null;
}): WeeklyWeekPresentation {
  const week = clampWeek(params.week);
  const latestFinal = Math.max(0, Math.floor(Number(params.latestFinalWeek) || 0));

  if (params.recapReady === true || params.slateStatus === "final") {
    return {
      label: "Recap",
      supportingLine: "Here's what happened.",
      recapReady: true,
    };
  }
  if (params.slateStatus === "live") {
    return {
      label: "Live",
      supportingLine: "Scores are still moving — not a final recap.",
      recapReady: false,
    };
  }
  if (params.slateStatus === "upcoming") {
    return {
      label: "Upcoming",
      supportingLine: "Matchups are on the board, but nothing is final.",
      recapReady: false,
    };
  }
  if (params.slateStatus === "unavailable") {
    return {
      label: "Unavailable",
      supportingLine: "Final scores aren't in yet — not a completed recap.",
      recapReady: false,
    };
  }

  // No server slate yet — calendar heuristic only (never invents "ready" for future weeks).
  if (week > latestFinal) {
    if (params.mode === "preview") {
      return {
        label: "Upcoming",
        supportingLine: "Here's what's coming.",
        recapReady: false,
      };
    }
    return {
      label: "Live",
      supportingLine: "This week isn't final yet — not a completed recap.",
      recapReady: false,
    };
  }
  if (latestFinal < 1) {
    return {
      label: "Upcoming",
      supportingLine: "No completed week yet.",
      recapReady: false,
    };
  }
  // Calendar says this week can be final, but roast hasn't confirmed recapReady.
  if (params.recapReady === false) {
    return {
      label: "Unavailable",
      supportingLine: "Final scores aren't confirmed yet.",
      recapReady: false,
    };
  }
  return {
    label: "Recap",
    supportingLine: params.mode === "recap" ? "Here's what happened." : "Here's what's coming.",
    recapReady: params.mode === "recap",
  };
}

/** Commissioner bridge line — never "Recap is ready" for non-final weeks. */
export function weeklyCommissionerBridgeLine(params: {
  week: number;
  mode: WeeklyEmailMode;
  presentation: WeeklyWeekPresentation;
}): string {
  const headline = weeklyPresentationHeadline(params.week, params.presentation);
  if (params.presentation.recapReady && params.mode === "recap") {
    return `${headline} is ready.`;
  }
  if (params.presentation.label === "Live") {
    return `Week ${clampWeek(params.week)} is live — recap isn't ready yet.`;
  }
  if (params.presentation.label === "Upcoming") {
    return `Week ${clampWeek(params.week)} is upcoming — not a recap.`;
  }
  if (params.presentation.label === "Unavailable") {
    return `Week ${clampWeek(params.week)} scores aren't ready for a recap.`;
  }
  return params.mode === "preview"
    ? `${headline} setup is ready.`
    : `${headline} isn't ready yet.`;
}
