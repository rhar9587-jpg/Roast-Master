import { describe, expect, it } from "vitest";
import {
  matchupFinalityTruth,
  personalMatchupResult,
  pickClosestFinalGame,
  pickFraudWatchPair,
  pickLargestMarginWinner,
  pickSmallestMarginWinner,
  pickStoleOneAndGotRobbed,
} from "./matchupOutcomes";
import { pickVillainFromMatchups, computeWeeklySuperlatives } from "../weeklyCommissioner";
import { buildWeeklyRoastNarrative } from "../weeklyRoastEngine";
import type { SleeperMatchup } from "../../league-history/sleeper";

function pair(
  matchupId: number,
  a: { roster_id: number; points: number },
  b: { roster_id: number; points: number },
): SleeperMatchup[] {
  return [
    { matchup_id: matchupId, roster_id: a.roster_id, points: a.points },
    { matchup_id: matchupId, roster_id: b.roster_id, points: b.points },
  ];
}

const FINAL_NORMAL = [
  ...pair(1, { roster_id: 1, points: 120.5 }, { roster_id: 2, points: 110.0 }),
  ...pair(2, { roster_id: 3, points: 95.2 }, { roster_id: 4, points: 88.1 }),
];

const FINAL_WITH_TIE = [
  ...pair(1, { roster_id: 1, points: 100 }, { roster_id: 2, points: 100 }),
  ...pair(2, { roster_id: 3, points: 130 }, { roster_id: 4, points: 90 }),
];

const FUTURE_SHELL = pair(1, { roster_id: 1, points: 0 }, { roster_id: 2, points: 0 });

const LIVE_PARTIAL = pair(1, { roster_id: 1, points: 45.5 }, { roster_id: 2, points: 12.0 });

const MALFORMED = [{ matchup_id: 1, roster_id: 1, points: 88 } as SleeperMatchup];

const ONLY_TIE = pair(1, { roster_id: 1, points: 111.1 }, { roster_id: 2, points: 111.1 });

describe("matchupOutcomes — classification fixtures", () => {
  it("normal final matchup yields a winner", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 120.5 },
      { roster_id: 2, points: 110 },
      { weekIsFinal: true },
    );
    expect(truth).toEqual({
      hasWinner: true,
      isTie: false,
      hasNoFinalResult: false,
      winnerRosterId: 1,
    });
    expect(pickLargestMarginWinner(FINAL_NORMAL, { weekIsFinal: true })?.winnerRosterId).toBe(1);
    expect(pickSmallestMarginWinner(FINAL_NORMAL, { weekIsFinal: true })?.winnerRosterId).toBe(3);
  });

  it("final tie has no winner", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 100 },
      { roster_id: 2, points: 100 },
      { weekIsFinal: true },
    );
    expect(truth).toEqual({ hasWinner: false, isTie: true, hasNoFinalResult: false });
    expect(personalMatchupResult(1, { roster_id: 1, points: 100 }, { roster_id: 2, points: 100 })).toBe(
      "TIE",
    );
  });

  it("future 0–0 shell has no final result", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 0 },
      { roster_id: 2, points: 0 },
      { weekIsFinal: true },
    );
    expect(truth).toEqual({ hasWinner: false, isTie: false, hasNoFinalResult: true });
    expect(pickLargestMarginWinner(FUTURE_SHELL, { weekIsFinal: true })).toBeNull();
    expect(pickStoleOneAndGotRobbed(FUTURE_SHELL, { weekIsFinal: true })).toBeNull();
  });

  it("non-final partial scores have no final result", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 45.5 },
      { roster_id: 2, points: 12 },
      { weekIsFinal: false },
    );
    expect(truth).toEqual({ hasWinner: false, isTie: false, hasNoFinalResult: true });
    expect(personalMatchupResult(1, { roster_id: 1, points: 45.5 }, { roster_id: 2, points: 12 }, {
      weekIsFinal: false,
    })).toBe("PENDING");
  });

  it("malformed one-sided matchup is ignored", () => {
    const truth = matchupFinalityTruth({ roster_id: 1, points: 88 }, null, { weekIsFinal: true });
    expect(truth.hasNoFinalResult).toBe(true);
    expect(pickLargestMarginWinner(MALFORMED, { weekIsFinal: true })).toBeNull();
    expect(pickSmallestMarginWinner(MALFORMED, { weekIsFinal: true })).toBeNull();
  });
});

describe("villain / blowout / stole-robbed guards", () => {
  const names = (id: string) => `Team ${id}`;

  it("villain ignores tie-only weeks", () => {
    expect(pickVillainFromMatchups(ONLY_TIE, names, true)).toBeNull();
    expect(pickSmallestMarginWinner(ONLY_TIE, { weekIsFinal: true })).toBeNull();
  });

  it("villain ignores live partial matchups", () => {
    expect(pickVillainFromMatchups(LIVE_PARTIAL, names, false)).toBeNull();
    expect(pickSmallestMarginWinner(LIVE_PARTIAL, { weekIsFinal: false })).toBeNull();
  });

  it("villain picks smallest-margin completed winner when available", () => {
    const v = pickVillainFromMatchups(FINAL_WITH_TIE, names, true);
    expect(v?.teamName).toBe("Team 3");
  });

  it("blowout ignores tie", () => {
    expect(pickLargestMarginWinner(ONLY_TIE, { weekIsFinal: true })).toBeNull();
  });

  it("blowout ignores live partial matchup", () => {
    expect(pickLargestMarginWinner(LIVE_PARTIAL, { weekIsFinal: false })).toBeNull();
  });

  it("blowout picks largest completed margin and skips the tie pair", () => {
    const b = pickLargestMarginWinner(FINAL_WITH_TIE, { weekIsFinal: true });
    expect(b).toMatchObject({
      winnerRosterId: 3,
      loserRosterId: 4,
      margin: 40,
    });
  });

  it("stole-one / got-robbed ignores tie", () => {
    expect(pickStoleOneAndGotRobbed(ONLY_TIE, { weekIsFinal: true })).toBeNull();
    const supers = computeWeeklySuperlatives(ONLY_TIE, names, null, true);
    expect(supers?.stoleOne).toBeUndefined();
    expect(supers?.gotRobbed).toBeUndefined();
  });

  it("stole-one / got-robbed ignores live partial matchup", () => {
    expect(pickStoleOneAndGotRobbed(LIVE_PARTIAL, { weekIsFinal: false })).toBeNull();
    const supers = computeWeeklySuperlatives(LIVE_PARTIAL, names, null, false);
    expect(supers?.stoleOne).toBeUndefined();
    expect(supers?.gotRobbed).toBeUndefined();
  });

  it("stole-one / got-robbed use completed winners only", () => {
    const pick = pickStoleOneAndGotRobbed(FINAL_WITH_TIE, { weekIsFinal: true });
    expect(pick?.stoleOne.teamRosterId).toBe(3);
    expect(pick?.gotRobbed.teamRosterId).toBe(4);
  });

  it("closest final game may include a tie (margin 0) but not live shells", () => {
    expect(pickClosestFinalGame(ONLY_TIE, { weekIsFinal: true })?.margin).toBe(0);
    expect(pickClosestFinalGame(LIVE_PARTIAL, { weekIsFinal: false })).toBeNull();
    expect(pickClosestFinalGame(FUTURE_SHELL, { weekIsFinal: true })).toBeNull();
  });

  it("fraud watch ignores ties and live partials", () => {
    expect(pickFraudWatchPair(ONLY_TIE, 100, { weekIsFinal: true })).toBeNull();
    expect(pickFraudWatchPair(LIVE_PARTIAL, 30, { weekIsFinal: false })).toBeNull();
  });
});

describe("autopsy-style win attribution", () => {
  it("does not award a winner for ties or live games", () => {
    const tie = matchupFinalityTruth(
      { roster_id: 1, points: 100 },
      { roster_id: 2, points: 100 },
      { weekIsFinal: true },
    );
    const live = matchupFinalityTruth(
      { roster_id: 1, points: 50 },
      { roster_id: 2, points: 40 },
      { weekIsFinal: false },
    );
    expect(tie.hasWinner).toBe(false);
    expect(live.hasWinner).toBe(false);

    // Same rule autopsy blowout / highest-loss use
    expect(pickLargestMarginWinner(ONLY_TIE, { weekIsFinal: true })).toBeNull();
    expect(pickLargestMarginWinner(LIVE_PARTIAL, { weekIsFinal: false })).toBeNull();
  });

  it("completed historical matchup behaviour remains unchanged", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 10, points: 140.2 },
      { roster_id: 11, points: 99.8 },
      { weekIsFinal: true },
    );
    expect(truth.winnerRosterId).toBe(10);
    const blowout = pickLargestMarginWinner(
      pair(7, { roster_id: 10, points: 140.2 }, { roster_id: 11, points: 99.8 }),
      { weekIsFinal: true },
    );
    expect(blowout).toMatchObject({
      winnerRosterId: 10,
      loserRosterId: 11,
      margin: expect.closeTo(40.4, 5),
    });
  });
});

describe("cross-feature invariant", () => {
  const fixtures: Array<{
    label: string;
    a: { roster_id: number; points: number };
    b: { roster_id: number; points: number };
    weekIsFinal: boolean;
    expect: { hasWinner: boolean; isTie: boolean; hasNoFinalResult: boolean };
  }> = [
    {
      label: "final completed",
      a: { roster_id: 1, points: 112 },
      b: { roster_id: 2, points: 101 },
      weekIsFinal: true,
      expect: { hasWinner: true, isTie: false, hasNoFinalResult: false },
    },
    {
      label: "final tie",
      a: { roster_id: 1, points: 105 },
      b: { roster_id: 2, points: 105 },
      weekIsFinal: true,
      expect: { hasWinner: false, isTie: true, hasNoFinalResult: false },
    },
    {
      label: "future shell",
      a: { roster_id: 1, points: 0 },
      b: { roster_id: 2, points: 0 },
      weekIsFinal: true,
      expect: { hasWinner: false, isTie: false, hasNoFinalResult: true },
    },
    {
      label: "live partial",
      a: { roster_id: 1, points: 33 },
      b: { roster_id: 2, points: 21 },
      weekIsFinal: false,
      expect: { hasWinner: false, isTie: false, hasNoFinalResult: true },
    },
  ];

  for (const fx of fixtures) {
    it(`roast, commissioner, and autopsy agree on ${fx.label}`, async () => {
      const opts = { weekIsFinal: fx.weekIsFinal };
      const truth = matchupFinalityTruth(fx.a, fx.b, opts);
      expect(truth.hasWinner).toBe(fx.expect.hasWinner);
      expect(truth.isTie).toBe(fx.expect.isTie);
      expect(truth.hasNoFinalResult).toBe(fx.expect.hasNoFinalResult);

      const rows = pair(1, fx.a, fx.b);
      const names = (id: string) => `T${id}`;

      // Commissioner winner-dependent metrics
      const villain = pickVillainFromMatchups(rows, names, fx.weekIsFinal);
      const stole = pickStoleOneAndGotRobbed(rows, opts);
      if (fx.expect.hasWinner) {
        expect(villain).not.toBeNull();
        expect(stole).not.toBeNull();
      } else {
        expect(villain).toBeNull();
        expect(stole).toBeNull();
      }

      // Autopsy-style blowout
      const blowout = pickLargestMarginWinner(rows, opts);
      if (fx.expect.hasWinner) expect(blowout).not.toBeNull();
      else expect(blowout).toBeNull();

      // Weekly roast winner-dependent cards
      const narrative = await buildWeeklyRoastNarrative({
        league: { league_id: "x", name: "Test", season: "2024" },
        week: 3,
        matchups: rows,
        rosterName: (rid) => `T${rid}`,
        weekIsFinal: fx.weekIsFinal,
      });
      const hasBlowoutCard = narrative.cards.some((c) => c.type === "biggest_embarrassment");
      const hasFraudCard = narrative.cards.some((c) => c.type === "fraud_watch");
      if (fx.expect.hasWinner) {
        expect(hasBlowoutCard).toBe(true);
      } else {
        expect(hasBlowoutCard).toBe(false);
        expect(hasFraudCard).toBe(false);
        expect(narrative.signals.blowoutMargin).toBeNull();
      }

      // Personal result agrees
      const personal = personalMatchupResult(fx.a.roster_id, fx.a, fx.b, opts);
      if (fx.expect.isTie) expect(personal).toBe("TIE");
      else if (fx.expect.hasWinner) expect(personal).toBe("WIN");
      else expect(personal).toBe("PENDING");
    });
  }
});
