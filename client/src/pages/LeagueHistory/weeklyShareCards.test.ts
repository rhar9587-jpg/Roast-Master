import { describe, expect, it } from "vitest";
import { mapEngineCardToVisual } from "./weeklyShareCards";
import {
  formatMargin,
  resolveWrappedVariant,
} from "../../components/wrappedCardModel";

const stats = {
  averageScore: 100,
  highestScorer: { roster_id: 1, username: "The Landlord", score: 167.4 },
  lowestScorer: { roster_id: 2, username: "Rebuild Forever", score: 62.1 },
};

describe("mapEngineCardToVisual", () => {
  it("maps Top Dog to one name + one score", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "top_dog",
        title: "Top Dog",
        subtitle: "The Landlord paced the league this week.",
        stat: "167.4 pts",
        tagline: "Highest score on the board.",
        meta: { username: "The Landlord", score: 167.4 },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("TOP DOG");
    expect(visual.title).toBe("THE LANDLORD");
    expect(visual.bigValue).toBe("167.4");
    expect(visual.subtitle).toContain("Week 8");
    expect(resolveWrappedVariant(visual)).toBe("hero");
  });

  it("maps Week 8 Murder Scene from structured meta (no prose scrape)", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "biggest_embarrassment",
        title: "Biggest Embarrassment",
        subtitle: "The Landlord dropped Rebuild Forever by 105.3.",
        stat: "+105.3 pts",
        tagline: "Not competitive.",
        meta: {
          winner_name: "The Landlord",
          loser_name: "Rebuild Forever",
          winner_score: 167.4,
          loser_score: 62.1,
          margin: 105.3,
        },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("WEEK 8");
    expect(visual.title).toBe("MURDER SCENE");
    expect(visual.isMatchup).toBe(true);
    expect(visual.matchupData).toEqual({
      teamA: "The Landlord",
      scoreA: 167.4,
      teamB: "Rebuild Forever",
      scoreB: 62.1,
      margin: 105.3,
    });
    expect(visual.bigValue).toBe("+105.3");
    expect(formatMargin(visual.matchupData!)).toBe("+105.3");
    expect(resolveWrappedVariant(visual)).toBe("matchup");
  });

  it("does not invent team names from subtitle when structured names are missing", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "biggest_embarrassment",
        title: "Biggest Embarrassment",
        subtitle: "Alpha dropped Beta by 99.0.",
        tagline: "Not competitive.",
        meta: {
          winner_score: 140,
          loser_score: 41,
          margin: 99,
        },
      },
      8,
      { stats },
    );
    expect(visual.matchupData?.teamA).toBe("Winner");
    expect(visual.matchupData?.teamB).toBe("Loser");
  });

  it("maps lowest scorer to Straight to Jail", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "lowest_scorer",
        title: "Straight to Jail",
        tagline: "Rough night.",
        meta: { username: "Rebuild Forever", score: 62.1 },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("STRAIGHT TO JAIL");
    expect(visual.title).toBe("REBUILD FOREVER");
    expect(visual.bigValue).toBe("62.1");
    expect(resolveWrappedVariant(visual)).toBe("hero");
  });
});
