import { describe, expect, it } from "vitest";
import { isNflFantasySeasonActive } from "@shared/nflSeasonStatus";
import {
  clampWeek,
  navigateWeeklyWeek,
  resolveDefaultLandingMode,
  resolveDefaultWeeklyContext,
  resolveLandingModeUnlessOverridden,
  resolveWeekForMode,
  resolveWeeklyContextUnlessOverridden,
  weeklyHeadline,
} from "./weeklyContext";

describe("resolveDefaultLandingMode", () => {
  it("active regular season → default tab Weekly", () => {
    expect(resolveDefaultLandingMode("regular")).toBe("weekly");
  });

  it("preseason → default tab Weekly (preview-capable)", () => {
    expect(resolveDefaultLandingMode("pre")).toBe("weekly");
  });

  it("offseason → default tab Receipts/History", () => {
    expect(resolveDefaultLandingMode("off")).toBe("history");
  });

  it("post-season → default tab Receipts/History", () => {
    expect(resolveDefaultLandingMode("post")).toBe("history");
  });

  it("missing/unknown NFL season type fails closed to Receipts", () => {
    expect(resolveDefaultLandingMode(null)).toBe("history");
    expect(resolveDefaultLandingMode(undefined)).toBe("history");
    expect(resolveDefaultLandingMode("")).toBe("history");
    expect(resolveDefaultLandingMode("weird")).toBe("history");
  });

  it("respects Weekly feature flag off", () => {
    expect(resolveDefaultLandingMode("regular", false)).toBe("history");
  });
});

describe("isNflFantasySeasonActive (shared SoT)", () => {
  it("treats pre + regular as active", () => {
    expect(isNflFantasySeasonActive("pre")).toBe(true);
    expect(isNflFantasySeasonActive("regular")).toBe(true);
    expect(isNflFantasySeasonActive("PRE")).toBe(true);
  });

  it("treats post + off + unknown as inactive", () => {
    expect(isNflFantasySeasonActive("post")).toBe(false);
    expect(isNflFantasySeasonActive("off")).toBe(false);
    expect(isNflFantasySeasonActive(null)).toBe(false);
  });
});

describe("resolveDefaultWeeklyContext", () => {
  it("active season with completed Week 8 and live Week 9 → Week 8 Recap", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 8,
        recapWeek: 8,
        previewWeek: 9,
      }),
    ).toEqual({ mode: "recap", week: 8 });
  });

  it("no completed week yet → Preview of current relevant week", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 0,
        recapWeek: 1,
        previewWeek: 1,
      }),
    ).toEqual({ mode: "preview", week: 1 });
  });

  it("future 0–0 shell (live preview week) is never selected as completed recap", () => {
    const sel = resolveDefaultWeeklyContext({
      latestFinalWeek: 8,
      recapWeek: 8,
      previewWeek: 9,
    });
    expect(sel.mode).toBe("recap");
    expect(sel.week).toBe(8);
    expect(sel.week).not.toBe(9);
  });

  it("week 1 in progress never invents a completed recap week", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 0,
        recapWeek: 1,
        previewWeek: 1,
      }).mode,
    ).toBe("preview");
  });
});

describe("manual overrides are preserved", () => {
  it("manual tab override is preserved (season default not reapplied)", () => {
    expect(resolveLandingModeUnlessOverridden("regular", true)).toBeNull();
    expect(resolveLandingModeUnlessOverridden("off", true)).toBeNull();
    expect(resolveLandingModeUnlessOverridden("regular", false)).toBe("weekly");
  });

  it("manual week override is preserved (smart week not reapplied)", () => {
    const nfl = { latestFinalWeek: 8, recapWeek: 8, previewWeek: 9 };
    expect(resolveWeeklyContextUnlessOverridden(nfl, true)).toBeNull();
    expect(resolveWeeklyContextUnlessOverridden(nfl, false)).toEqual({
      mode: "recap",
      week: 8,
    });
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
