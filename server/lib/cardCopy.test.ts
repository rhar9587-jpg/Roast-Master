// server/lib/cardCopy.test.ts
import { describe, it, expect } from "vitest";
import {
  selectCardCopy,
  getTaglinesForCard,
  interpolateTagline,
  type CardType,
} from "./cardCopy";

const ALL_CARD_TYPES: CardType[] = [
  // Your Season
  "season_mvp",
  "best_win",
  "worst_enemy",
  "choke_jobs",
  // Recap
  "last_place",
  "season_high",
  "season_low",
  "biggest_blowout",
  "highest_loss",
];

describe("selectCardCopy", () => {
  it("returns deterministic tagline for same league + card type", () => {
    const result1 = selectCardCopy("last_place", "test-league-123");
    const result2 = selectCardCopy("last_place", "test-league-123");

    expect(result1.tagline).toBe(result2.tagline);
    expect(result1.isSpicy).toBe(false);
  });

  it("returns different taglines for different leagues", () => {
    const results = new Set<string>();
    const testLeagues = [
      "league-aaa",
      "league-bbb",
      "league-ccc",
      "league-ddd",
      "league-eee",
      "league-fff",
    ];

    for (const leagueId of testLeagues) {
      const result = selectCardCopy("last_place", leagueId);
      results.add(result.tagline);
    }

    // With 6 variants and 6 leagues, we should get some variety
    // (may not be all 6 due to hash collisions, but should be > 1)
    expect(results.size).toBeGreaterThan(1);
  });

  it("returns spicy variant when requested", () => {
    const safe = selectCardCopy("last_place", "test-league", false);
    const spicy = selectCardCopy("last_place", "test-league", true);

    expect(safe.isSpicy).toBe(false);
    expect(spicy.isSpicy).toBe(true);
  });

  it("returns non-empty tagline for all card types", () => {
    for (const cardType of ALL_CARD_TYPES) {
      const result = selectCardCopy(cardType, "test-league");
      expect(result.tagline).toBeTruthy();
      expect(result.tagline.length).toBeGreaterThan(0);
    }
  });

  it("returns taglines under 60 characters for all card types", () => {
    for (const cardType of ALL_CARD_TYPES) {
      // Test multiple leagues to catch all variants
      for (let i = 0; i < 10; i++) {
        const result = selectCardCopy(cardType, `league-${i}`);
        expect(result.tagline.length).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe("getTaglinesForCard", () => {
  it("returns array of safe taglines", () => {
    const taglines = getTaglinesForCard("last_place", false);
    expect(Array.isArray(taglines)).toBe(true);
    expect(taglines.length).toBeGreaterThanOrEqual(6);
  });

  it("returns array of spicy taglines", () => {
    const taglines = getTaglinesForCard("last_place", true);
    expect(Array.isArray(taglines)).toBe(true);
    expect(taglines.length).toBeGreaterThanOrEqual(6);
  });

  it("returns different arrays for safe vs spicy", () => {
    const safe = getTaglinesForCard("season_mvp", false);
    const spicy = getTaglinesForCard("season_mvp", true);

    // Arrays should have different content
    expect(safe).not.toEqual(spicy);
  });

  it("returns empty array for invalid card type", () => {
    // @ts-expect-error - testing invalid input
    const taglines = getTaglinesForCard("invalid_card_type");
    expect(taglines).toEqual([]);
  });
});

describe("interpolateTagline", () => {
  it("replaces {name} placeholder", () => {
    const result = interpolateTagline("{name} owns you this season.", {
      name: "JohnDoe",
    });
    expect(result).toBe("JohnDoe owns you this season.");
  });

  it("replaces {opponent} placeholder", () => {
    const result = interpolateTagline("You cooked {opponent}.", {
      opponent: "TeamAlpha",
    });
    expect(result).toBe("You cooked TeamAlpha.");
  });

  it("replaces multiple placeholders", () => {
    const result = interpolateTagline("{name} beat {opponent} easily.", {
      name: "Player1",
      opponent: "Player2",
    });
    expect(result).toBe("Player1 beat Player2 easily.");
  });

  it("replaces multiple occurrences of same placeholder", () => {
    const result = interpolateTagline("{name} vs {name}", {
      name: "Bob",
    });
    expect(result).toBe("Bob vs Bob");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const result = interpolateTagline("{name} vs {team}", {
      name: "Bob",
    });
    expect(result).toBe("Bob vs {team}");
  });

  it("handles empty replacements object", () => {
    const result = interpolateTagline("No placeholders here.", {});
    expect(result).toBe("No placeholders here.");
  });
});

describe("card type coverage", () => {
  it("has variants for all Your Season cards", () => {
    const yourSeasonCards: CardType[] = [
      "season_mvp",
      "best_win",
      "worst_enemy",
      "choke_jobs",
    ];

    for (const cardType of yourSeasonCards) {
      const safe = getTaglinesForCard(cardType, false);
      const spicy = getTaglinesForCard(cardType, true);
      expect(safe.length).toBeGreaterThanOrEqual(6);
      expect(spicy.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("has variants for all Recap cards", () => {
    const recapCards: CardType[] = [
      "last_place",
      "season_high",
      "season_low",
      "biggest_blowout",
      "highest_loss",
    ];

    for (const cardType of recapCards) {
      const safe = getTaglinesForCard(cardType, false);
      const spicy = getTaglinesForCard(cardType, true);
      expect(safe.length).toBeGreaterThanOrEqual(6);
      expect(spicy.length).toBeGreaterThanOrEqual(6);
    }
  });
});
