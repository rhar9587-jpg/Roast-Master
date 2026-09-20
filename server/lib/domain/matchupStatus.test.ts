import { describe, expect, it } from "vitest";
import {
  classifyMatchupGroup,
  classifyMatchupPair,
  isCompletedMatchupPoints,
} from "./matchupStatus";
import {
  buildTeamStatesThroughWeek,
  formatTeamRecord,
  weekKeyedScoresFromState,
} from "./teamStateThroughWeek";

describe("matchupStatus", () => {
  it("classifies a normal completed week (strict winner, no >=)", () => {
    const result = classifyMatchupPair(
      { rosterId: 1, points: 120.5 },
      { rosterId: 2, points: 110.0 },
    );
    expect(result).toEqual({
      status: "completed",
      winner: { rosterId: 1, points: 120.5 },
      loser: { rosterId: 2, points: 110.0 },
    });
  });

  it("classifies a true tie without inventing a winner", () => {
    const result = classifyMatchupPair(
      { rosterId: 1, points: 100 },
      { rosterId: 2, points: 100 },
    );
    expect(result.status).toBe("tie");
    if (result.status === "tie") {
      expect(result.a.rosterId).toBe(1);
      expect(result.b.rosterId).toBe(2);
    }
  });

  it("classifies future 0–0 shells as scheduled", () => {
    expect(
      classifyMatchupPair({ rosterId: 1, points: 0 }, { rosterId: 2, points: 0 }),
    ).toEqual({ status: "scheduled" });
    expect(isCompletedMatchupPoints(0, 0)).toBe(false);
  });

  it("classifies malformed / missing pairs", () => {
    expect(classifyMatchupPair(null, { rosterId: 2, points: 10 })).toEqual({
      status: "malformed",
      reason: "missing_side",
    });
    expect(classifyMatchupGroup([{ roster_id: 1, points: 10 }])).toEqual({
      status: "malformed",
      reason: "incomplete_pair",
    });
    expect(
      classifyMatchupGroup([
        { roster_id: 1, points: Number.NaN },
        { roster_id: 2, points: 10 },
      ]),
    ).toEqual({ status: "malformed", reason: "invalid_points" });
  });

  it("does not treat equal scores as a win via >=", () => {
    const tied = classifyMatchupPair(
      { rosterId: 1, points: 95.5 },
      { rosterId: 2, points: 95.5 },
    );
    expect(tied.status).toBe("tie");
    expect(tied).not.toHaveProperty("winner");
  });

  it("marks nonzero scores as in_progress when weekIsFinal is false", () => {
    const result = classifyMatchupPair(
      { rosterId: 1, points: 45.2 },
      { rosterId: 2, points: 38.0 },
      { weekIsFinal: false },
    );
    expect(result).toEqual({
      status: "in_progress",
      a: { rosterId: 1, points: 45.2 },
      b: { rosterId: 2, points: 38.0 },
    });
  });

  it("still treats 0–0 as scheduled even when weekIsFinal is false", () => {
    expect(
      classifyMatchupPair(
        { rosterId: 1, points: 0 },
        { rosterId: 2, points: 0 },
        { weekIsFinal: false },
      ),
    ).toEqual({ status: "scheduled" });
  });
});

describe("buildTeamStatesThroughWeek", () => {
  const identities = [
    { rosterId: 1, ownerId: "owner-a", displayName: "Alpha" },
    { rosterId: 2, ownerId: "owner-b", displayName: "Beta" },
    { rosterId: 3, ownerId: null, displayName: "Gamma" },
  ];

  it("builds standings for a normal completed week", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 1,
      identities,
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 120 },
          { matchup_id: 1, roster_id: 2, points: 100 },
          { matchup_id: 2, roster_id: 3, points: 90 },
          // bye / incomplete pair ignored as malformed
        ],
      },
    });
    const alpha = states.find((s) => s.rosterId === 1)!;
    const beta = states.find((s) => s.rosterId === 2)!;
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(0);
    expect(alpha.pointsFor).toBe(120);
    expect(alpha.pointsAgainst).toBe(100);
    expect(alpha.weeklyScores.get(1)).toBe(120);
    expect(beta.wins).toBe(0);
    expect(beta.losses).toBe(1);
    expect(alpha.ownerKey).toBe("owner:owner-a");
    expect(states.find((s) => s.rosterId === 3)!.ownerKey).toBe("roster:3");
  });

  it("counts true ties in record and PF/PA", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 1,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 111 },
          { matchup_id: 1, roster_id: 2, points: 111 },
        ],
      },
    });
    const alpha = states[0]!;
    expect(alpha.wins).toBe(0);
    expect(alpha.losses).toBe(0);
    expect(alpha.ties).toBe(1);
    expect(alpha.pointsFor).toBe(111);
    expect(alpha.pointsAgainst).toBe(111);
    expect(formatTeamRecord(alpha.wins, alpha.losses, alpha.ties)).toBe("0-0-1");
  });

  it("ignores future 0–0 matchup shells", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 2,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 100 },
          { matchup_id: 1, roster_id: 2, points: 90 },
        ],
        2: [
          { matchup_id: 1, roster_id: 1, points: 0 },
          { matchup_id: 1, roster_id: 2, points: 0 },
        ],
      },
    });
    const alpha = states[0]!;
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(0);
    expect(alpha.weeklyScores.has(2)).toBe(false);
    expect(alpha.pointsFor).toBe(100);
  });

  it("skips a missing whole week without shifting later weeks", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 3,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 100 },
          { matchup_id: 1, roster_id: 2, points: 90 },
        ],
        // week 2 absent
        3: [
          { matchup_id: 1, roster_id: 1, points: 80 },
          { matchup_id: 1, roster_id: 2, points: 95 },
        ],
      },
    });
    const alpha = states[0]!;
    const keyed = weekKeyedScoresFromState(alpha);
    expect(keyed.map((k) => k.week)).toEqual([1, 3]);
    expect(keyed.map((k) => k.score)).toEqual([100, 80]);
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(1);
  });

  it("handles missing roster row without inventing a team", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 1,
      identities: [{ rosterId: 1, ownerId: "a", displayName: "Only" }],
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 100 },
          { matchup_id: 1, roster_id: 99, points: 80 }, // unknown roster
        ],
      },
    });
    expect(states).toHaveLength(1);
    expect(states[0]!.wins).toBe(1);
    expect(states[0]!.pointsAgainst).toBe(80);
    expect(states.find((s) => s.rosterId === 99)).toBeUndefined();
  });

  it("reconstructs undefeated 7–0 from matchups", () => {
    const ids = [
      { rosterId: 1, ownerId: "champ", displayName: "Champ" },
      { rosterId: 2, ownerId: "opp", displayName: "Opp" },
    ];
    const matchupsByWeek: Record<number, Array<{ matchup_id: number; roster_id: number; points: number }>> = {};
    for (let w = 1; w <= 7; w++) {
      matchupsByWeek[w] = [
        { matchup_id: 1, roster_id: 1, points: 110 + w },
        { matchup_id: 1, roster_id: 2, points: 90 },
      ];
    }
    const champ = buildTeamStatesThroughWeek({
      throughWeek: 7,
      identities: ids,
      matchupsByWeek,
    })[0]!;
    expect(champ.wins).toBe(7);
    expect(champ.losses).toBe(0);
    expect(champ.ties).toBe(0);
    expect(formatTeamRecord(champ.wins, champ.losses, champ.ties)).toBe("7-0");
  });

  it("historical Week 3 standings ignore later weeks (Week 10 data present)", () => {
    const matchupsByWeek: Record<number, Array<{ matchup_id: number; roster_id: number; points: number }>> = {};
    // Weeks 1–3: Alpha goes 2–1
    matchupsByWeek[1] = [
      { matchup_id: 1, roster_id: 1, points: 100 },
      { matchup_id: 1, roster_id: 2, points: 90 },
    ];
    matchupsByWeek[2] = [
      { matchup_id: 1, roster_id: 1, points: 95 },
      { matchup_id: 1, roster_id: 2, points: 100 },
    ];
    matchupsByWeek[3] = [
      { matchup_id: 1, roster_id: 1, points: 120 },
      { matchup_id: 1, roster_id: 2, points: 80 },
    ];
    // Weeks 4–10: Alpha wins every remaining week → through Week 10 is 9–1
    // (not 8–2; that figure is only used as misleading roster.settings elsewhere)
    for (let w = 4; w <= 10; w++) {
      matchupsByWeek[w] = [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ];
    }

    const through3 = buildTeamStatesThroughWeek({
      throughWeek: 3,
      identities: identities.slice(0, 2),
      matchupsByWeek,
    })[0]!;
    const through10 = buildTeamStatesThroughWeek({
      throughWeek: 10,
      identities: identities.slice(0, 2),
      matchupsByWeek,
    })[0]!;

    expect(through3.wins).toBe(2);
    expect(through3.losses).toBe(1);
    expect(through3.pointsFor).toBe(100 + 95 + 120);
    expect(through3.pointsAgainst).toBe(90 + 100 + 80);
    expect(Array.from(through3.weeklyScores.keys()).sort((a, b) => a - b)).toEqual([1, 2, 3]);

    expect(through10.wins).toBe(9);
    expect(through10.losses).toBe(1);
  });

  it("completed historical matchup counts toward W/L", () => {
    const alpha = buildTeamStatesThroughWeek({
      throughWeek: 1,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 110 },
          { matchup_id: 1, roster_id: 2, points: 100 },
        ],
      },
      isWeekFinal: () => true,
    })[0]!;
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(0);
    expect(alpha.weeklyScores.get(1)).toBe(110);
  });

  it("future 0–0 does not count toward standings", () => {
    const alpha = buildTeamStatesThroughWeek({
      throughWeek: 1,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 0 },
          { matchup_id: 1, roster_id: 2, points: 0 },
        ],
      },
    })[0]!;
    expect(alpha.wins).toBe(0);
    expect(alpha.losses).toBe(0);
    expect(alpha.weeklyScores.size).toBe(0);
  });

  it("nonzero in-progress matchup does NOT produce W/L when week is not final", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 2,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 100 },
          { matchup_id: 1, roster_id: 2, points: 90 },
        ],
        2: [
          { matchup_id: 1, roster_id: 1, points: 55.5 },
          { matchup_id: 1, roster_id: 2, points: 42.0 },
        ],
      },
      // Week 1 final; Week 2 still live
      isWeekFinal: (week) => week < 2,
    });
    const alpha = states[0]!;
    expect(alpha.wins).toBe(1);
    expect(alpha.losses).toBe(0);
    expect(alpha.pointsFor).toBe(100);
    expect(alpha.pointsAgainst).toBe(90);
    expect(alpha.weeklyScores.has(2)).toBe(false);
    // Raw live score preserved separately
    expect(alpha.liveWeeklyScores.get(2)).toBe(55.5);
    expect(states[1]!.liveWeeklyScores.get(2)).toBe(42.0);
  });

  it("accumulates pointsAgainst only through the historical week", () => {
    const states = buildTeamStatesThroughWeek({
      throughWeek: 2,
      identities: identities.slice(0, 2),
      matchupsByWeek: {
        1: [
          { matchup_id: 1, roster_id: 1, points: 100 },
          { matchup_id: 1, roster_id: 2, points: 40 },
        ],
        2: [
          { matchup_id: 1, roster_id: 1, points: 110 },
          { matchup_id: 1, roster_id: 2, points: 50 },
        ],
        3: [
          { matchup_id: 1, roster_id: 1, points: 200 },
          { matchup_id: 1, roster_id: 2, points: 199 },
        ],
      },
    });
    expect(states[0]!.pointsAgainst).toBe(90);
    expect(states[0]!.pointsFor).toBe(210);
  });
});
