import { describe, expect, it } from "vitest";
import { isFantasySeasonComplete } from "@shared/seasonComplete";
import { weekSlateHeadline } from "@shared/weekSlateLabels";
import {
  autopsyGenerateLabel,
  autopsyModeSupportingLine,
  autopsySectionTitle,
  seasonModeSupportingLine,
} from "./seasonModeCopy";
import {
  weeklyPresentationHeadline,
  resolveWeeklyWeekPresentation,
} from "./weeklyContext";

describe("week selector / commissioner headlines never say Recap for non-final", () => {
  it("week selector labels do not say Recap for non-final weeks", () => {
    for (const label of ["Live", "Upcoming", "Unavailable"] as const) {
      const headline = weeklyPresentationHeadline(3, label);
      expect(headline).not.toMatch(/Recap/);
      expect(headline).toBe(`Week 3 ${label}`);
    }
    expect(weeklyPresentationHeadline(3, "Recap")).toBe("Week 3 Recap");
  });

  it("commissioner heading does not say Recap for non-final weeks", () => {
    const presentation = resolveWeeklyWeekPresentation({
      week: 3,
      mode: "recap",
      latestFinalWeek: 2,
      slateStatus: "upcoming",
      recapReady: false,
    });
    expect(weeklyPresentationHeadline(3, presentation)).toBe("Week 3 Upcoming");
    expect(presentation.recapReady).toBe(false);
  });
});

describe("public week slate headline nouns", () => {
  it("public page H1 says Upcoming for upcoming week", () => {
    expect(weekSlateHeadline(3, "upcoming", "public")).toBe("Week 3 Upcoming");
  });

  it("public page H1 says Live for live week", () => {
    expect(weekSlateHeadline(3, "live", "public")).toBe("Week 3 Live");
  });

  it("public page says Recap only for final week", () => {
    expect(weekSlateHeadline(3, "final", "public")).toBe("Week 3 Recap");
    expect(weekSlateHeadline(3, "unavailable", "public")).toBe("Week 3 Results Unavailable");
  });
});

describe("active vs completed season page copy", () => {
  it("active season page copy says Season so far", () => {
    expect(seasonModeSupportingLine(false).toLowerCase()).toContain("so far");
    expect(autopsyModeSupportingLine(false).toLowerCase()).toContain("so far");
    expect(autopsyModeSupportingLine(false).toLowerCase()).not.toContain("final verdict");
    expect(autopsySectionTitle(false)).toBe("Season so far");
    expect(autopsyGenerateLabel(false)).toBe("Generate season snapshot");
    expect(
      isFantasySeasonComplete(
        { season: "2026", settings: { playoff_week_end: 17 } },
        { season: "2026", season_type: "regular", latestFinalWeek: 2 },
      ),
    ).toBe(false);
  });

  it("completed season still uses final-season copy", () => {
    expect(autopsyModeSupportingLine(true)).toContain("final verdict");
    expect(autopsySectionTitle(true)).toBe("End-of-Season");
    expect(autopsyGenerateLabel(true)).toBe("Generate End-of-Season");
    expect(
      isFantasySeasonComplete(
        { season: "2025", settings: { playoff_week_end: 17 } },
        { season: "2026", season_type: "regular", latestFinalWeek: 2 },
      ),
    ).toBe(true);
  });
});
