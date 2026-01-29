// server/lib/seasonTagline.test.ts
import { describe, it, expect } from "vitest";
import { classifyBucket, selectTagline, type TaglineInput } from "./seasonTagline";

const baseInput: TaglineInput = {
  wins: 7,
  losses: 7,
  ties: 0,
  rank: 6,
  leagueSize: 12,
  pointsFor: 1700,
  pointsAgainst: 1700,
  leagueId: "test-league-123",
};

describe("classifyBucket", () => {
  it("returns DEFAULT for 0-0 record", () => {
    expect(
      classifyBucket({ ...baseInput, wins: 0, losses: 0, ties: 0 })
    ).toBe("DEFAULT");
  });

  it("UNLUCKY_DISASTER: bad record but outscored opponents by 100+", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 4,
        losses: 10,
        rank: 10,
        pointsFor: 1900,
        pointsAgainst: 1750,
      })
    ).toBe("UNLUCKY_DISASTER");
  });

  it("DOMINANT_CHAMP: 12-2, rank 1", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 12,
        losses: 2,
        rank: 1,
        pointsFor: 2000,
        pointsAgainst: 1600,
      })
    ).toBe("DOMINANT_CHAMP");
  });

  it("DOMINANT_NO_TITLE: 12-2, rank 2 (choked)", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 12,
        losses: 2,
        rank: 2,
        pointsFor: 2000,
        pointsAgainst: 1600,
      })
    ).toBe("DOMINANT_NO_TITLE");
  });

  it("GOOD_SEASON: 60%+ win rate, top third placement", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 10,
        losses: 4,
        rank: 3,
        pointsFor: 1880,
        pointsAgainst: 1700,
      })
    ).toBe("GOOD_SEASON");
  });

  it("OVERACHIEVER: bad record but high placement", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 5,
        losses: 9,
        rank: 3,
        leagueSize: 10,
        pointsFor: 1600,
        pointsAgainst: 1700,
      })
    ).toBe("OVERACHIEVER");
  });

  it("UNLUCKY_MID: mediocre record but outscored by 50+", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 6,
        losses: 8,
        rank: 7,
        pointsFor: 1810,
        pointsAgainst: 1750,
      })
    ).toBe("UNLUCKY_MID");
  });

  it("COIN_FLIP: true .500 with balanced PF/PA", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 7,
        losses: 7,
        rank: 6,
        pointsFor: 1700,
        pointsAgainst: 1710,
      })
    ).toBe("COIN_FLIP");
  });

  it("UNDERACHIEVER: good record but bad placement", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 9,
        losses: 5,
        rank: 8,
        leagueSize: 10,
        pointsFor: 1750,
        pointsAgainst: 1680,
      })
    ).toBe("UNDERACHIEVER");
  });

  it("BAD_SEASON: below .400, bottom third", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 5,
        losses: 9,
        rank: 10,
        pointsFor: 1520,
        pointsAgainst: 1680,
      })
    ).toBe("BAD_SEASON");
  });

  it("DISASTER: very bad record", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 2,
        losses: 12,
        rank: 11,
        pointsFor: 1400,
        pointsAgainst: 1800,
      })
    ).toBe("DISASTER");
  });

  it("DISASTER: last place regardless of record", () => {
    expect(
      classifyBucket({
        ...baseInput,
        wins: 6,
        losses: 8,
        rank: 12,
        leagueSize: 12,
        pointsFor: 1600,
        pointsAgainst: 1700,
      })
    ).toBe("DISASTER");
  });
});

describe("selectTagline", () => {
  it("returns deterministic tagline for same input", () => {
    const input: TaglineInput = {
      wins: 7,
      losses: 7,
      ties: 0,
      rank: 6,
      leagueSize: 12,
      pointsFor: 1700,
      pointsAgainst: 1710,
      leagueId: "test-league-abc",
    };

    const result1 = selectTagline(input);
    const result2 = selectTagline(input);

    expect(result1.tagline).toBe(result2.tagline);
    expect(result1.bucket).toBe("COIN_FLIP");
    expect(result1.isSpicy).toBe(false);
  });

  it("returns spicy variant when requested", () => {
    const input: TaglineInput = {
      wins: 12,
      losses: 2,
      ties: 0,
      rank: 1,
      leagueSize: 12,
      pointsFor: 2000,
      pointsAgainst: 1600,
      leagueId: "test-league-xyz",
    };

    const safe = selectTagline(input, false);
    const spicy = selectTagline(input, true);

    expect(safe.bucket).toBe("DOMINANT_CHAMP");
    expect(spicy.bucket).toBe("DOMINANT_CHAMP");
    expect(safe.isSpicy).toBe(false);
    expect(spicy.isSpicy).toBe(true);
    // Taglines may differ between safe and spicy pools
  });

  it("different leagues get potentially different taglines", () => {
    const input1: TaglineInput = {
      ...baseInput,
      leagueId: "league-aaa",
    };
    const input2: TaglineInput = {
      ...baseInput,
      leagueId: "league-bbb",
    };

    // Same bucket, but hash may select different variants
    const result1 = selectTagline(input1);
    const result2 = selectTagline(input2);

    expect(result1.bucket).toBe(result2.bucket);
    // Taglines could be same or different depending on hash
  });

  it("tagline is within character limit", () => {
    const scenarios: TaglineInput[] = [
      { ...baseInput, wins: 12, losses: 2, rank: 1 }, // DOMINANT_CHAMP
      { ...baseInput, wins: 12, losses: 2, rank: 2 }, // DOMINANT_NO_TITLE
      { ...baseInput, wins: 4, losses: 10, rank: 10, pointsFor: 1900, pointsAgainst: 1750 }, // UNLUCKY_DISASTER
      { ...baseInput, wins: 2, losses: 12, rank: 12 }, // DISASTER
      { ...baseInput, wins: 7, losses: 7, rank: 6, pointsFor: 1700, pointsAgainst: 1710 }, // COIN_FLIP
    ];

    for (const scenario of scenarios) {
      const result = selectTagline(scenario);
      expect(result.tagline.length).toBeLessThanOrEqual(60);
    }
  });
});
