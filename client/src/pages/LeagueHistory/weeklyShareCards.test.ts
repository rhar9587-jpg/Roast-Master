import { describe, expect, it } from "vitest";
import { mapEngineCardToVisual } from "./weeklyShareCards";

const stats = {
  averageScore: 100,
  highestScorer: { roster_id: 1, username: "Alpha", score: 168.4 },
  lowestScorer: { roster_id: 2, username: "Beta", score: 62.1 },
};

describe("mapEngineCardToVisual", () => {
  it("maps Top Dog to one name + one score", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "top_dog",
        title: "Top Dog",
        subtitle: "Alpha paced the league this week.",
        stat: "168.4 pts",
        tagline: "Highest score on the board.",
        meta: { username: "Alpha", score: 168.4 },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("TOP DOG");
    expect(visual.title).toBe("ALPHA");
    expect(visual.bigValue).toBe("168.4");
    expect(visual.subtitle).toContain("Week 8");
  });

  it("maps blowout to Murder Scene with scoreboard + margin", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "biggest_embarrassment",
        title: "Biggest Embarrassment",
        subtitle: "Alpha dropped Beta by 105.3.",
        stat: "+105.3 pts",
        tagline: "Not competitive.",
        meta: {
          winner_score: 168.4,
          loser_score: 63.1,
          margin: 105.3,
        },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("WEEK 8");
    expect(visual.title).toBe("MURDER SCENE");
    expect(visual.isMatchup).toBe(true);
    expect(visual.matchupData?.teamA).toBe("Alpha");
    expect(visual.matchupData?.teamB).toBe("Beta");
    expect(visual.bigValue).toBe("+105.3");
  });

  it("maps lowest scorer to Straight to Jail", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "lowest_scorer",
        title: "Straight to Jail",
        tagline: "Rough night.",
        meta: { username: "Beta", score: 62.1 },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("STRAIGHT TO JAIL");
    expect(visual.title).toBe("BETA");
    expect(visual.bigValue).toBe("62.1");
  });
});
