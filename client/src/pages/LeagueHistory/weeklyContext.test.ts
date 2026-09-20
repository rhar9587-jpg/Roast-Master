import { describe, expect, it } from "vitest";
import {
  clampWeek,
  navigateWeeklyWeek,
  resolveDefaultWeeklyContext,
  resolveWeekForMode,
  weeklyHeadline,
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
});
