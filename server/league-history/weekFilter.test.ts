import { describe, it, expect } from "vitest";
import { computeSeasonWeekRange, getPlayoffStartWeek } from "./weekFilter";

describe("computeSeasonWeekRange", () => {
  describe("when include_playoffs is false (default)", () => {
    it("should clamp end week to regular season (playoffStartWeek=15 -> end=14)", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 17,
        playoffStartWeek: 15,
        includePlayoffs: false,
      });

      expect(result).toEqual({ start: 1, end: 14 });
    });

    it("should clamp end week to regular season (playoffStartWeek=16 -> end=15)", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 17,
        playoffStartWeek: 16,
        includePlayoffs: false,
      });

      expect(result).toEqual({ start: 1, end: 15 });
    });

    it("should keep end week if already below playoff start (requestedEnd=10)", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 10,
        playoffStartWeek: 15,
        includePlayoffs: false,
      });

      expect(result).toEqual({ start: 1, end: 10 });
    });

    it("should return null when requested range is entirely in playoffs", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 15,
        requestedEnd: 17,
        playoffStartWeek: 15,
        includePlayoffs: false,
      });

      expect(result).toBeNull();
    });

    it("should return null when start week equals playoff start week", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 16,
        requestedEnd: 17,
        playoffStartWeek: 16,
        includePlayoffs: false,
      });

      expect(result).toBeNull();
    });

    it("should handle edge case where playoffStartWeek is 1 (all playoffs)", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 17,
        playoffStartWeek: 1,
        includePlayoffs: false,
      });

      // regularSeasonEnd = Math.max(1, 1 - 1) = Math.max(1, 0) = 1
      // But effectiveEnd = min(17, 1) = 1
      // Since effectiveEnd (1) >= requestedStart (1), returns valid range
      expect(result).toEqual({ start: 1, end: 1 });
    });
  });

  describe("when include_playoffs is true", () => {
    it("should NOT clamp end week - use full requested range", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 17,
        playoffStartWeek: 15,
        includePlayoffs: true,
      });

      expect(result).toEqual({ start: 1, end: 17 });
    });

    it("should allow requesting only playoff weeks", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 15,
        requestedEnd: 17,
        playoffStartWeek: 15,
        includePlayoffs: true,
      });

      expect(result).toEqual({ start: 15, end: 17 });
    });

    it("should respect requested range even if below playoff start", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 1,
        requestedEnd: 10,
        playoffStartWeek: 15,
        includePlayoffs: true,
      });

      expect(result).toEqual({ start: 1, end: 10 });
    });
  });

  describe("edge cases", () => {
    it("should handle requestedStart > requestedEnd gracefully", () => {
      // This shouldn't happen in practice (validated upstream), but test the behavior
      const result = computeSeasonWeekRange({
        requestedStart: 10,
        requestedEnd: 5,
        playoffStartWeek: 15,
        includePlayoffs: false,
      });

      // effectiveEnd = min(5, 14) = 5
      // 5 < 10, so returns null
      expect(result).toBeNull();
    });

    it("should handle single-week regular season", () => {
      const result = computeSeasonWeekRange({
        requestedStart: 14,
        requestedEnd: 17,
        playoffStartWeek: 15,
        includePlayoffs: false,
      });

      expect(result).toEqual({ start: 14, end: 14 });
    });
  });
});

describe("getPlayoffStartWeek", () => {
  it("should return 15 for null settings", () => {
    expect(getPlayoffStartWeek(null)).toBe(15);
  });

  it("should return 15 for undefined settings", () => {
    expect(getPlayoffStartWeek(undefined)).toBe(15);
  });

  it("should return 15 for empty settings", () => {
    expect(getPlayoffStartWeek({})).toBe(15);
  });

  it("should prefer playoff_start_week when present", () => {
    expect(getPlayoffStartWeek({ 
      playoff_start_week: 14,
      playoff_week_start: 16,
      playoff_week_end: 18,
    })).toBe(14);
  });

  it("should use playoff_week_start as fallback", () => {
    expect(getPlayoffStartWeek({ 
      playoff_week_start: 16,
      playoff_week_end: 18,
    })).toBe(16);
  });

  it("should compute from playoff_week_end if only end is present", () => {
    // Assumes 2-round playoffs: end - 1, but at least 15
    expect(getPlayoffStartWeek({ 
      playoff_week_end: 17,
    })).toBe(16); // max(15, 17-1) = max(15, 16) = 16
  });

  it("should floor to 15 when computing from low playoff_week_end", () => {
    expect(getPlayoffStartWeek({ 
      playoff_week_end: 14,
    })).toBe(15); // max(15, 14-1) = max(15, 13) = 15
  });
});
