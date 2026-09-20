import { describe, expect, it } from "vitest";
import {
  isResolvedBye,
  resolvePlayoffBrackets,
  type SleeperBracketRow,
} from "./playoffBracket";
import { buildSeasonOutcomes, rankRegularSeasonStandings } from "./seasonOutcome";

/** Classic 6-team winners bracket (Sleeper docs shape), fully resolved. */
function sixTeamCompletedBracket(opts?: {
  /** Championship winner roster id (default 4 — the lower seed). */
  champion?: number;
  /** Championship loser (default 1 — the #1 seed). */
  runnerUp?: number;
  unresolvedChampionship?: boolean;
}): SleeperBracketRow[] {
  const champion = opts?.champion ?? 4;
  const runnerUp = opts?.runnerUp ?? 1;
  const champW = opts?.unresolvedChampionship ? null : champion;
  const champL = opts?.unresolvedChampionship ? null : runnerUp;

  return [
    // Round 1: 3 vs 6, 4 vs 5
    { r: 1, m: 1, t1: 3, t2: 6, w: 3, l: 6 },
    { r: 1, m: 2, t1: 4, t2: 5, w: 4, l: 5 },
    // Round 2: byes for 1 & 2
    { r: 2, m: 3, t1: 1, t2: 3, t2_from: { w: 1 }, w: 1, l: 3 },
    { r: 2, m: 4, t1: 2, t2: 4, t2_from: { w: 2 }, w: 4, l: 2 },
    // 5th place
    { r: 2, m: 5, t1: 6, t2: 5, t1_from: { l: 1 }, t2_from: { l: 2 }, w: 5, l: 6, p: 5 },
    // Championship + 3rd place
    {
      r: 3,
      m: 6,
      t1: runnerUp,
      t2: champion,
      t1_from: { w: 3 },
      t2_from: { w: 4 },
      w: champW,
      l: champL,
      p: 1,
    },
    { r: 3, m: 7, t1: 3, t2: 2, t1_from: { l: 3 }, t2_from: { l: 4 }, w: 2, l: 3, p: 3 },
  ];
}

function consolationToiletBowl(): SleeperBracketRow[] {
  // 12-team league non-playoff consolation; p:11 → winner 11th, loser 12th (spoon)
  return [
    { r: 1, m: 1, t1: 7, t2: 12, w: 7, l: 12 },
    { r: 1, m: 2, t1: 8, t2: 11, w: 8, l: 11 },
    { r: 1, m: 3, t1: 9, t2: 10, w: 10, l: 9 },
    { r: 2, m: 4, t1: 12, t2: 11, w: 11, l: 12, p: 11 },
  ];
}

const regularStandings12 = [
  { rosterId: 1, wins: 11, losses: 3, pointsFor: 1800 },
  { rosterId: 2, wins: 10, losses: 4, pointsFor: 1750 },
  { rosterId: 3, wins: 9, losses: 5, pointsFor: 1700 },
  { rosterId: 4, wins: 8, losses: 6, pointsFor: 1650 },
  { rosterId: 5, wins: 8, losses: 6, pointsFor: 1600 },
  { rosterId: 6, wins: 7, losses: 7, pointsFor: 1550 },
  { rosterId: 7, wins: 6, losses: 8, pointsFor: 1500 },
  { rosterId: 8, wins: 5, losses: 9, pointsFor: 1450 },
  { rosterId: 9, wins: 5, losses: 9, pointsFor: 1400 },
  { rosterId: 10, wins: 4, losses: 10, pointsFor: 1350 },
  { rosterId: 11, wins: 3, losses: 11, pointsFor: 1300 },
  { rosterId: 12, wins: 2, losses: 12, pointsFor: 1200 },
];

describe("playoffBracket", () => {
  it("resolves a normal 6-team playoff bracket", () => {
    const resolved = resolvePlayoffBrackets(sixTeamCompletedBracket());
    expect(resolved.playoffRosterIds.size).toBe(6);
    expect([...resolved.playoffRosterIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("derives champion from winners bracket", () => {
    const resolved = resolvePlayoffBrackets(sixTeamCompletedBracket({ champion: 4, runnerUp: 1 }));
    expect(resolved.championshipResolved).toBe(true);
    expect(resolved.championRosterId).toBe(4);
  });

  it("derives runner-up from championship matchup", () => {
    const resolved = resolvePlayoffBrackets(sixTeamCompletedBracket({ champion: 4, runnerUp: 1 }));
    expect(resolved.runnerUpRosterId).toBe(1);
    expect(resolved.finalFinishByRosterId.get(1)).toBe(2);
    expect(resolved.finalFinishByRosterId.get(4)).toBe(1);
  });

  it("handles bye week in playoff bracket", () => {
    const byeOnly: SleeperBracketRow[] = [
      { r: 1, m: 1, t1: 3, t2: 6, w: 3, l: 6 },
      { r: 2, m: 2, t1: 1, t2: null, t2_from: { w: 1 }, w: 1, l: null },
    ];
    expect(isResolvedBye(byeOnly[1]!)).toBe(true);
    const resolved = resolvePlayoffBrackets(byeOnly);
    expect(resolved.playoffRosterIds.has(1)).toBe(true);
    expect(resolved.championshipResolved).toBe(false);
  });

  it("handles more than two playoff rounds", () => {
    const eightTeam: SleeperBracketRow[] = [
      { r: 1, m: 1, t1: 1, t2: 8, w: 1, l: 8 },
      { r: 1, m: 2, t1: 4, t2: 5, w: 4, l: 5 },
      { r: 1, m: 3, t1: 2, t2: 7, w: 2, l: 7 },
      { r: 1, m: 4, t1: 3, t2: 6, w: 3, l: 6 },
      { r: 2, m: 5, t1: 1, t2: 4, w: 1, l: 4 },
      { r: 2, m: 6, t1: 2, t2: 3, w: 3, l: 2 },
      { r: 3, m: 7, t1: 1, t2: 3, w: 3, l: 1, p: 1 },
      { r: 3, m: 8, t1: 4, t2: 2, w: 2, l: 4, p: 3 },
    ];
    const resolved = resolvePlayoffBrackets(eightTeam);
    expect(resolved.championRosterId).toBe(3);
    expect(resolved.runnerUpRosterId).toBe(1);
    expect(resolved.finalFinishByRosterId.get(2)).toBe(3);
    expect(resolved.finalFinishByRosterId.get(4)).toBe(4);
  });

  it("leaves champion unknown for incomplete/live bracket", () => {
    const resolved = resolvePlayoffBrackets(
      sixTeamCompletedBracket({ unresolvedChampionship: true }),
    );
    expect(resolved.championshipResolved).toBe(false);
    expect(resolved.championRosterId).toBeUndefined();
    expect(resolved.runnerUpRosterId).toBeUndefined();
  });

  it("ignores malformed / partial bracket rows safely", () => {
    const messy: SleeperBracketRow[] = [
      null as unknown as SleeperBracketRow,
      { r: 1 }, // missing m
      { r: 1, m: 1, t1: 1, t2: 2, w: null, l: null },
      { r: 3, m: 9, t1: 1, t2: 2, w: 1, l: 2, p: 1 },
    ];
    const resolved = resolvePlayoffBrackets(messy);
    expect(resolved.championRosterId).toBe(1);
    expect(resolved.playoffRosterIds.has(1)).toBe(true);
  });

  it("determines last place from consolation / toilet-bowl bracket", () => {
    const resolved = resolvePlayoffBrackets([], consolationToiletBowl());
    expect(resolved.lastPlaceFromConsolation).toBe(true);
    expect(resolved.lastPlaceRosterId).toBe(12);
  });
});

describe("seasonOutcome", () => {
  it("keeps regularSeasonRank=1 when #1 seed loses championship to #4", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      regularSeasonStandings: regularStandings12,
      playoffTeams: 6,
      winnersBracket: sixTeamCompletedBracket({ champion: 4, runnerUp: 1 }),
      losersBracket: [],
      leagueSize: 12,
    });
    const byId = new Map(outcomes.map((o) => [o.rosterId, o]));
    expect(byId.get(1)?.regularSeasonRank).toBe(1);
    expect(byId.get(1)?.championshipWon).toBe(false);
    expect(byId.get(1)?.runnerUp).toBe(true);
    expect(byId.get(1)?.finalFinish).toBe(2);
    expect(byId.get(1)?.playoffQualified).toBe(true);

    expect(byId.get(4)?.regularSeasonRank).toBe(4);
    expect(byId.get(4)?.championshipWon).toBe(true);
    expect(byId.get(4)?.finalFinish).toBe(1);
    expect(byId.get(4)?.playoffQualified).toBe(true);
  });

  it("does not invent champion from missing settings.rank / absent bracket", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: [1, 2, 3],
      // no standings, no bracket
      playoffTeams: 6,
    });
    for (const o of outcomes) {
      expect(o.regularSeasonRank).toBeUndefined();
      expect(o.championshipWon).toBeUndefined();
      expect(o.playoffQualified).toBeUndefined();
      expect(o.regularSeasonRank).not.toBe(0);
    }
  });

  it("does not qualify everyone when playoff_teams missing and no bracket", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: [1, 2, 3, 4],
      regularSeasonStandings: [
        { rosterId: 1, wins: 10, losses: 4, pointsFor: 100 },
        { rosterId: 2, wins: 9, losses: 5, pointsFor: 90 },
        { rosterId: 3, wins: 5, losses: 9, pointsFor: 80 },
        { rosterId: 4, wins: 2, losses: 12, pointsFor: 70 },
      ],
    });
    expect(outcomes.every((o) => o.playoffQualified === undefined)).toBe(true);
  });

  it("uses playoff_teams cutoff only when ranks are known and no bracket", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: [1, 2, 3, 4],
      playoffTeams: 2,
      regularSeasonStandings: [
        { rosterId: 1, wins: 10, losses: 4, pointsFor: 100 },
        { rosterId: 2, wins: 9, losses: 5, pointsFor: 90 },
        { rosterId: 3, wins: 5, losses: 9, pointsFor: 80 },
        { rosterId: 4, wins: 2, losses: 12, pointsFor: 70 },
      ],
    });
    const byId = new Map(outcomes.map((o) => [o.rosterId, o]));
    expect(byId.get(1)?.playoffQualified).toBe(true);
    expect(byId.get(2)?.playoffQualified).toBe(true);
    expect(byId.get(3)?.playoffQualified).toBe(false);
    expect(byId.get(4)?.playoffQualified).toBe(false);
  });

  it("regular-season last is not spoon when consolation awards last to another roster", () => {
    const losers = [
      { r: 1, m: 1, t1: 7, t2: 12, w: 12, l: 7 },
      { r: 2, m: 2, t1: 12, t2: 11, w: 12, l: 11, p: 11 }, // 11 gets 12th
    ];
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: regularStandings12.map((r) => r.rosterId),
      regularSeasonStandings: regularStandings12,
      playoffTeams: 6,
      winnersBracket: sixTeamCompletedBracket(),
      losersBracket: losers,
      leagueSize: 12,
    });
    const byId = new Map(outcomes.map((o) => [o.rosterId, o]));
    expect(byId.get(12)?.regularSeasonRank).toBe(12);
    expect(byId.get(12)?.lastPlace).toBe(false);
    expect(byId.get(11)?.lastPlace).toBe(true);
  });

  it("historical complete bracket populates champion and finishes", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2022",
      rosterIds: [1, 2, 3, 4, 5, 6],
      regularSeasonStandings: regularStandings12.slice(0, 6),
      playoffTeams: 6,
      winnersBracket: sixTeamCompletedBracket({ champion: 2, runnerUp: 3 }),
      losersBracket: [],
      leagueSize: 6,
    });
    const champ = outcomes.find((o) => o.championshipWon);
    expect(champ?.rosterId).toBe(2);
    expect(champ?.finalFinish).toBe(1);
    expect(outcomes.find((o) => o.runnerUp)?.rosterId).toBe(3);
  });
});

describe("seasonOutcome invariant: #1 seed loses to #4 seed", () => {
  it("keeps seed, championship, finishes, and qualification consistent", () => {
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: [1, 2, 3, 4, 5, 6],
      regularSeasonStandings: regularStandings12.slice(0, 6),
      playoffTeams: 6,
      winnersBracket: sixTeamCompletedBracket({ champion: 4, runnerUp: 1 }),
      losersBracket: [],
      leagueSize: 6,
    });
    const one = outcomes.find((o) => o.rosterId === 1)!;
    const four = outcomes.find((o) => o.rosterId === 4)!;

    expect(one.regularSeasonRank).toBe(1);
    expect(four.championshipWon).toBe(true);
    expect(one.championshipWon).toBe(false);
    expect(four.finalFinish).toBe(1);
    expect(one.finalFinish).toBe(2);
    expect(one.playoffQualified).toBe(true);
    expect(four.playoffQualified).toBe(true);
    expect(four.regularSeasonRank).toBe(4);
  });
});

describe("rankRegularSeasonStandings", () => {
  it("orders by wins then PF without using settings.rank", () => {
    const ranks = rankRegularSeasonStandings([
      { rosterId: 10, wins: 8, losses: 6, pointsFor: 200 },
      { rosterId: 20, wins: 10, losses: 4, pointsFor: 150 },
      { rosterId: 30, wins: 8, losses: 6, pointsFor: 220 },
    ]);
    expect(ranks.get(20)).toBe(1);
    expect(ranks.get(30)).toBe(2);
    expect(ranks.get(10)).toBe(3);
  });
});
