/**
 * Tests for public recap hero selection (presentation-only).
 */

import { describe, expect, it } from "vitest";
import {
  closestGameHeroCandidate,
  publicRecapDisplayTitle,
  publicRecapHeroPriority,
  selectPublicRecapHero,
  selectPublicRecapSupportingMoments,
} from "./publicRecapHero";

describe("publicRecapHero selection", () => {
  it("prefers Murder Scene / biggest blowout over Top Dog", () => {
    const hero = selectPublicRecapHero([
      { type: "top_dog", title: "Top Dog", subtitle: "Alice paced the league.", stat: "142.3 pts" },
      {
        type: "biggest_embarrassment",
        title: "Biggest Embarrassment",
        subtitle: "Alice dropped Bob by 40.0.",
        stat: "+40.0 pts",
      },
      { type: "fraud_watch", title: "Fraud Watch", subtitle: "Bob won light.", stat: "Won light" },
    ]);
    expect(hero?.type).toBe("biggest_embarrassment");
    expect(hero?.title).toBe("Murder Scene");
  });

  it("prefers narrow escape over fraud and top dog when blowout missing", () => {
    const hero = selectPublicRecapHero(
      [
        { type: "top_dog", title: "Top Dog", subtitle: "Alice paced.", stat: "130 pts" },
        { type: "fraud_watch", title: "Fraud Watch", subtitle: "Light win.", stat: "Won light" },
      ],
      {
        closestGame: {
          teamA: "Alice",
          teamB: "Bob",
          scoreA: 101.2,
          scoreB: 100.8,
          margin: 0.4,
        },
      },
    );
    expect(hero?.type).toBe("closest_game");
    expect(hero?.title).toBe("Narrow Escape");
  });

  it("falls back to Top Dog when only standout scoring exists", () => {
    const hero = selectPublicRecapHero([
      { type: "group_chat_drop", title: "Drop", subtitle: "Chat filler." },
      { type: "top_dog", title: "Top Dog", subtitle: "Alice paced.", stat: "142.3 pts" },
    ]);
    expect(hero?.type).toBe("top_dog");
    expect(hero?.title).toBe("Top Dog");
  });

  it("returns null when no usable cards", () => {
    expect(selectPublicRecapHero([])).toBeNull();
    expect(selectPublicRecapHero([{ type: "group_chat_drop", title: "x", subtitle: "y" }])).toBeNull();
  });

  it("uses the only usable card when that is all that exists", () => {
    const hero = selectPublicRecapHero([
      { type: "carry_job", title: "Carry Job", subtitle: "One player + vibes.", stat: "62%" },
    ]);
    expect(hero?.type).toBe("carry_job");
    expect(hero?.title).toBe("Carry Job");
  });

  it("limits supporting moments to 2–3 and excludes the hero type", () => {
    const cards = [
      { type: "biggest_embarrassment", title: "Biggest Embarrassment", subtitle: "Blowout.", stat: "+40" },
      { type: "top_dog", title: "Top Dog", subtitle: "High score.", stat: "140" },
      { type: "fraud_watch", title: "Fraud Watch", subtitle: "Won light.", stat: "Won light" },
      { type: "carry_job", title: "Carry Job", subtitle: "Carried.", stat: "55%" },
      { type: "worst_coaching", title: "Bench", subtitle: "Left pts.", stat: "40 bench" },
    ];
    const hero = selectPublicRecapHero(cards);
    expect(hero?.type).toBe("biggest_embarrassment");
    const supporting = selectPublicRecapSupportingMoments(cards, hero, 3);
    expect(supporting.length).toBeLessThanOrEqual(3);
    expect(supporting.length).toBeGreaterThanOrEqual(2);
    expect(supporting.every((s) => s.type !== hero!.type)).toBe(true);
    expect(supporting[0]?.type).toBe("fraud_watch");
  });

  it("maps display titles for distinctive moments", () => {
    expect(publicRecapDisplayTitle("biggest_embarrassment")).toBe("Murder Scene");
    expect(publicRecapDisplayTitle("worst_coaching")).toBe("Bench Crimes");
    expect(publicRecapDisplayTitle("lowest_scorer")).toBe("Straight to Jail");
    expect(publicRecapHeroPriority("biggest_embarrassment")).toBeLessThan(
      publicRecapHeroPriority("top_dog"),
    );
  });

  it("rejects closest-game candidate outside nail-biter margin", () => {
    expect(
      closestGameHeroCandidate({
        teamA: "A",
        teamB: "B",
        scoreA: 120,
        scoreB: 100,
        margin: 20,
      }),
    ).toBeNull();
  });
});
