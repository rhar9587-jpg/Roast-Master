import { describe, expect, it } from "vitest";
import {
  clampPosterText,
  computeMatchupMargin,
  extractHeroNumber,
  formatMargin,
  formatPosterName,
  formatScore,
  getAccentTheme,
  isBrandFooterText,
  posterNameSizeTier,
  resolveWrappedVariant,
  SHARE_CARD_ASPECT,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
} from "./wrappedCardModel";

describe("resolveWrappedVariant", () => {
  it("prefers matchup when structured matchupData is present", () => {
    expect(
      resolveWrappedVariant({
        isMatchup: true,
        matchupData: {
          teamA: "The Landlord",
          scoreA: 167.4,
          teamB: "Rebuild Forever",
          scoreB: 62.1,
        },
        bigValue: "+105.3",
      }),
    ).toBe("matchup");
  });

  it("uses hero when a real bigValue exists", () => {
    expect(resolveWrappedVariant({ bigValue: "168.4" })).toBe("hero");
  });

  it("falls back to verdict when no numeric hero", () => {
    expect(resolveWrappedVariant({ bigValue: "—" })).toBe("verdict");
    expect(resolveWrappedVariant({})).toBe("verdict");
  });
});

describe("poster formatting", () => {
  it("clamps long prose", () => {
    expect(clampPosterText("a".repeat(120), 40).endsWith("…")).toBe(true);
    expect(clampPosterText("  Short line  ", 40)).toBe("Short line");
    expect(clampPosterText(undefined, 40)).toBe("");
  });

  it("handles realistic difficult team names", () => {
    for (const name of [
      "Rebuild Forever",
      "Commissioner Chaos",
      "The Unnecessarily Long Fantasy Team Name",
      "FourthAndTwentyDynasty",
    ]) {
      const formatted = formatPosterName(name, 36);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted.length).toBeLessThanOrEqual(36);
      expect(posterNameSizeTier(formatted)).toMatch(/short|medium|long/);
    }
  });

  it("extracts clean hero numbers from mixed stat labels", () => {
    expect(extractHeroNumber("34.2 bench pts")).toBe("34.2");
    expect(extractHeroNumber("+105.3")).toBe("+105.3");
    expect(extractHeroNumber("Won light")).toBeNull();
  });

  it("detects redundant brand footer text", () => {
    expect(isBrandFooterText("fantasyroast.net")).toBe(true);
    expect(isBrandFooterText("Fantasy Roast")).toBe(true);
    expect(isBrandFooterText("My League Name")).toBe(false);
  });

  it("formats Week 8 Murder Scene margin from structured scores", () => {
    const data = {
      teamA: "The Landlord",
      scoreA: 167.4,
      teamB: "Rebuild Forever",
      scoreB: 62.1,
    };
    expect(computeMatchupMargin(data)).toBeCloseTo(105.3, 5);
    expect(formatMargin(data)).toBe("+105.3");
    expect(formatScore(167.4)).toBe("167.4");
  });
});

describe("accent themes + share ratio", () => {
  it("maps each accent to a theme", () => {
    for (const accent of ["green", "pink", "blue", "orange", "slate"] as const) {
      const theme = getAccentTheme(accent);
      expect(theme.id).toBe(accent);
      expect(theme.bg).toMatch(/^#/);
      expect(theme.highlight).toBeTruthy();
    }
  });

  it("uses a fixed 4:5 share canvas", () => {
    expect(SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT).toBeCloseTo(0.8, 5);
    expect(SHARE_CARD_ASPECT).toBe("540 / 675");
  });
});
