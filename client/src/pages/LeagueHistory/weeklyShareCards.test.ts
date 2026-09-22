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

  it("maps Fraud Watch to manager + score + short verdict label", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "fraud_watch",
        title: "Fraud Watch",
        subtitle: "Commissioner Chaos won at 78.2; league median was 112.4.",
        stat: "Won light",
        tagline: "Couldn't cash in anyway.",
        meta: {
          kind: "lucky_win",
          manager_name: "Commissioner Chaos",
          score: 78.2,
          medianScore: 112.4,
        },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("FRAUD WATCH");
    expect(visual.title).toBe("COMMISSIONER CHAOS");
    expect(visual.bigValue).toBe("78.2");
    expect(visual.statLabel).toBe("WON LIGHT");
    expect((visual.subtitle ?? "").length).toBeLessThanOrEqual(56);
    expect(resolveWrappedVariant(visual)).toBe("hero");
  });

  it("maps Bench Crimes to manager + numeric hero", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "worst_coaching",
        title: "Most Points Left on Bench",
        subtitle: "FourthAndTwentyDynasty left 84.2 pts on the bench.",
        stat: "84.2 bench pts",
        tagline: "Start your studs.",
        meta: {
          team_name: "FourthAndTwentyDynasty",
          benchPoints: 84.2,
        },
      },
      8,
      { stats },
    );
    expect(visual.kicker).toBe("BENCH CRIMES");
    expect(visual.title).toBe("FOURTHANDTWENTYDYNASTY");
    expect(visual.bigValue).toBe("84.2");
    expect(visual.statLabel?.toLowerCase()).toContain("bench");
    expect(resolveWrappedVariant(visual)).toBe("hero");
  });

  it("maps Carry Job to manager subject (not repeating category title)", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "carry_job",
        title: "Carry Job",
        subtitle: "Harks9 was basically Josh Allen + vibes.",
        stat: "31% of team points",
        tagline: "One player, most of the points.",
        meta: {
          manager_name: "Harks9",
          team_name: "Harks9",
          ratio: 0.31,
          share_pct: "31%",
          player_name: "Josh Allen",
        },
      },
      2,
      { stats },
    );
    expect(visual.kicker).toBe("CARRY JOB");
    expect(visual.title).toBe("HARKS9");
    expect(visual.title).not.toBe(visual.kicker);
    expect(visual.bigValue).toBe("31%");
    expect(visual.statLabel).toBe("of team points");
    expect(visual.tagline).toContain("One player");
    expect(resolveWrappedVariant(visual)).toBe("hero");
  });

  it("Carry Job without manager meta does not use category title as subject", () => {
    const visual = mapEngineCardToVisual(
      {
        type: "carry_job",
        title: "Carry Job",
        subtitle: "Someone was basically a star + vibes.",
        stat: "55% of team points",
        tagline: "One player, most of the points.",
        meta: { ratio: 0.55 },
      },
      2,
      { stats },
    );
    expect(visual.kicker).toBe("CARRY JOB");
    expect(visual.title.toLowerCase()).not.toBe("carry job");
  });

  it("other supporting categories keep category ≠ subject", () => {
    const top = mapEngineCardToVisual(
      {
        type: "top_dog",
        title: "Top Dog",
        subtitle: "The Landlord paced.",
        meta: { username: "The Landlord", score: 167.4 },
      },
      8,
      { stats },
    );
    expect(top.kicker).toBe("TOP DOG");
    expect(top.title).toBe("THE LANDLORD");

    const fraud = mapEngineCardToVisual(
      {
        type: "fraud_watch",
        title: "Fraud Watch",
        meta: { manager_name: "Chaos", score: 78.2, kind: "lucky_win" },
        stat: "Won light",
      },
      8,
      { stats },
    );
    expect(fraud.kicker).toBe("FRAUD WATCH");
    expect(fraud.title).toBe("CHAOS");

    const bench = mapEngineCardToVisual(
      {
        type: "worst_coaching",
        title: "Most Points Left on Bench",
        meta: { team_name: "Dynasty", benchPoints: 40 },
      },
      8,
      { stats },
    );
    expect(bench.kicker).toBe("BENCH CRIMES");
    expect(bench.title).toBe("DYNASTY");

    const jail = mapEngineCardToVisual(
      {
        type: "lowest_scorer",
        title: "Straight to Jail",
        meta: { username: "Rebuild Forever", score: 62.1 },
      },
      8,
      { stats },
    );
    expect(jail.kicker).toBe("STRAIGHT TO JAIL");
    expect(jail.title).toBe("REBUILD FOREVER");
  });
});
