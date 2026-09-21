import { describe, expect, it } from "vitest";
import {
  clampWeek,
  navigateWeeklyWeek,
  resolveDefaultWeeklyContext,
  resolveWeekForMode,
  resolveWeeklyWeekPresentation,
  weeklyCommissionerBridgeLine,
  weeklyHeadline,
  weeklyPresentationHeadline,
} from "./weeklyContext";

describe("resolveDefaultWeeklyContext", () => {
  it("defaults to Recap on the latest completed week when one exists", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 8,
        recapWeek: 8,
        previewWeek: 9,
      }),
    ).toEqual({ mode: "recap", week: 8 });
  });

  it("defaults to Preview when no completed week exists", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 0,
        recapWeek: 1,
        previewWeek: 1,
      }),
    ).toEqual({ mode: "preview", week: 1 });
  });

  it("latest completed week is selected by default (not live preview week)", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 2,
        recapWeek: 2,
        previewWeek: 3,
      }),
    ).toEqual({ mode: "recap", week: 2 });
  });
});

describe("resolveWeekForMode", () => {
  const nfl = { latestFinalWeek: 7, recapWeek: 7, previewWeek: 8 };

  it("applies smart week when switching to Recap", () => {
    expect(resolveWeekForMode("recap", nfl)).toBe(7);
  });

  it("applies smart week when switching to Preview", () => {
    expect(resolveWeekForMode("preview", nfl)).toBe(8);
  });

  it("falls back to recapWeek when latestFinalWeek is 0", () => {
    expect(
      resolveWeekForMode("recap", {
        latestFinalWeek: 0,
        recapWeek: 1,
        previewWeek: 1,
      }),
    ).toBe(1);
  });
});

describe("manual future week preserves selection but renders Upcoming/Live", () => {
  it("manual future week with recap mode is not recap-ready", () => {
    const presentation = resolveWeeklyWeekPresentation({
      week: 3,
      mode: "recap",
      latestFinalWeek: 2,
    });
    expect(presentation.recapReady).toBe(false);
    expect(["Live", "Upcoming"]).toContain(presentation.label);
  });

  it("all-zero unavailable slate is not recap-ready", () => {
    const presentation = resolveWeeklyWeekPresentation({
      week: 3,
      mode: "recap",
      latestFinalWeek: 3,
      slateStatus: "unavailable",
      recapReady: false,
    });
    expect(presentation.label).toBe("Unavailable");
    expect(presentation.recapReady).toBe(false);
  });
});

describe("commissioner bridge never says ready for non-final week", () => {
  it("commissioner recap cannot say ready for non-final week", () => {
    const presentation = resolveWeeklyWeekPresentation({
      week: 3,
      mode: "recap",
      latestFinalWeek: 3,
      slateStatus: "unavailable",
      recapReady: false,
    });
    const line = weeklyCommissionerBridgeLine({
      week: 3,
      mode: "recap",
      presentation,
    });
    expect(line.toLowerCase()).not.toContain("is ready");
    expect(line.toLowerCase()).not.toContain("recap is ready");
  });

  it("final recap can say ready", () => {
    const presentation = resolveWeeklyWeekPresentation({
      week: 2,
      mode: "recap",
      latestFinalWeek: 2,
      slateStatus: "final",
      recapReady: true,
    });
    expect(
      weeklyCommissionerBridgeLine({ week: 2, mode: "recap", presentation }),
    ).toContain("is ready");
  });
});

describe("navigateWeeklyWeek", () => {
  it("moves previous/next within 1–18", () => {
    expect(navigateWeeklyWeek(8, -1)).toBe(7);
    expect(navigateWeeklyWeek(8, 1)).toBe(9);
    expect(navigateWeeklyWeek(1, -1)).toBe(1);
    expect(navigateWeeklyWeek(18, 1)).toBe(18);
  });
});

describe("clampWeek / weeklyHeadline", () => {
  it("clamps invalid weeks", () => {
    expect(clampWeek(0)).toBe(1);
    expect(clampWeek(99)).toBe(18);
    expect(clampWeek(Number.NaN)).toBe(1);
  });

  it("formats the week headline", () => {
    expect(weeklyHeadline(8, "recap")).toBe("Week 8 Recap");
    expect(weeklyHeadline(9, "preview")).toBe("Week 9 Preview");
  });

  it("presentation headline never says Recap for Live/Upcoming/Unavailable", () => {
    expect(weeklyPresentationHeadline(3, "Upcoming")).toBe("Week 3 Upcoming");
    expect(weeklyPresentationHeadline(3, "Live")).toBe("Week 3 Live");
    expect(weeklyPresentationHeadline(3, "Unavailable")).toBe("Week 3 Unavailable");
  });
});
