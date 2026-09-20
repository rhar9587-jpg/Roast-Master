import { describe, expect, it } from "vitest";
import {
  computeExpectedWins,
  generatePowerRankings,
  type PowerRankingsTeamInput,
} from "./powerRankings";
import { buildTeamsFromMatchupData } from "./weeklyCommissioner";

describe("computeExpectedWins (week-keyed)", () => {
  it("joins by actual week number when Week 2 is missing", () => {
    // Team A: week1=100, week3=80 (no week 2)
    // Team B: week1=90, week3=95
    // If index-aligned, A's week3(80) would wrongly compare to B's week1(90).
    const a: PowerRankingsTeamInput = {
      teamId: "1",
      teamName: "A",
      wins: 1,
      losses: 1,
      pointsFor: 180,
      weeklyScores: [
        { week: 1, score: 100 },
        { week: 3, score: 80 },
      ],
    };
    const b: PowerRankingsTeamInput = {
      teamId: "2",
      teamName: "B",
      wins: 1,
      losses: 1,
      pointsFor: 185,
      weeklyScores: [
        { week: 1, score: 90 },
        { week: 3, score: 95 },
      ],
    };

    // Week 1: 100 > 90 → 1; Week 3: 80 > 95 → 0; EW = 1.0
    expect(computeExpectedWins(a, [a, b])).toBe(1);
    // Week 1: 90 > 100 → 0; Week 3: 95 > 80 → 1; EW = 1.0
    expect(computeExpectedWins(b, [a, b])).toBe(1);
  });

  it("does not treat an absent opponent score as zero", () => {
    const a: PowerRankingsTeamInput = {
      teamId: "1",
      teamName: "A",
      wins: 1,
      losses: 0,
      pointsFor: 50,
      weeklyScores: [{ week: 1, score: 50 }],
    };
    const b: PowerRankingsTeamInput = {
      teamId: "2",
      teamName: "B",
      wins: 0,
      losses: 0,
      pointsFor: 0,
      weeklyScores: [], // missing week 1 entirely
    };
    // No comparable opponents that week → 0 expected wins (not a free win vs 0)
    expect(computeExpectedWins(a, [a, b])).toBe(0);
  });
});

describe("generatePowerRankings record / ties", () => {
  it("includes ties in the record string", () => {
    const teams: PowerRankingsTeamInput[] = [
      {
        teamId: "1",
        teamName: "Tied",
        wins: 2,
        losses: 1,
        ties: 1,
        pointsFor: 400,
        weeklyScores: [
          { week: 1, score: 100 },
          { week: 2, score: 100 },
          { week: 3, score: 100 },
          { week: 4, score: 100 },
        ],
      },
      {
        teamId: "2",
        teamName: "Other",
        wins: 1,
        losses: 2,
        ties: 1,
        pointsFor: 380,
        weeklyScores: [
          { week: 1, score: 95 },
          { week: 2, score: 95 },
          { week: 3, score: 95 },
          { week: 4, score: 95 },
        ],
      },
    ];
    const rows = generatePowerRankings(teams);
    const tied = rows.find((r) => r.teamId === "1")!;
    expect(tied.record).toBe("2-1-1");
    expect(tied.ties).toBe(1);
    // winPct = (2 + 0.5) / 4 = 0.625
    expect(tied.winPct).toBe(0.625);
  });
});

describe("buildTeamsFromMatchupData / buildTeamsFromSleeper contract", () => {
  /**
   * Most important regression:
   * Current Sleeper roster.settings are 8–2, but matchups through Week 3 are 2–1.
   * Through-week builder must return 2–1 and Week 1–3 PF/PA.
   */
  it("returns through-week 2–1 despite current 8–2 roster.settings", () => {
    const rosters = [
      {
        roster_id: 1,
        owner_id: "u1",
        settings: {
          wins: 8,
          losses: 2,
          fpts: 1200,
          fpts_against: 900,
          fpts_against_decimal: 0,
        },
      },
      {
        roster_id: 2,
        owner_id: "u2",
        settings: { wins: 2, losses: 8, fpts: 800, fpts_against: 1100 },
      },
    ];
    const users = [
      { user_id: "u1", username: "alpha", display_name: "Alpha" },
      { user_id: "u2", username: "beta", display_name: "Beta" },
    ];

    const matchupsByWeek: Record<
      number,
      Array<{ matchup_id: number; roster_id: number; points: number }>
    > = {
      1: [
        { matchup_id: 1, roster_id: 1, points: 110 },
        { matchup_id: 1, roster_id: 2, points: 100 },
      ],
      2: [
        { matchup_id: 1, roster_id: 1, points: 95 },
        { matchup_id: 1, roster_id: 2, points: 105 },
      ],
      3: [
        { matchup_id: 1, roster_id: 1, points: 120 },
        { matchup_id: 1, roster_id: 2, points: 90 },
      ],
      // Later weeks that would produce 8–2 if incorrectly included:
      4: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      5: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      6: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      7: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      8: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      9: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
      10: [
        { matchup_id: 1, roster_id: 1, points: 130 },
        { matchup_id: 1, roster_id: 2, points: 70 },
      ],
    };

    const { teams } = buildTeamsFromMatchupData({
      leagueName: "Test League",
      throughWeek: 3,
      rosters,
      users,
      matchupsByWeek,
    });

    const alpha = teams.find((t) => t.teamId === "1")!;
    expect(alpha.wins).toBe(2);
    expect(alpha.losses).toBe(1);
    expect(alpha.ties).toBe(0);
    expect(alpha.pointsFor).toBe(110 + 95 + 120);
    expect(alpha.pointsAgainst).toBe(100 + 105 + 90);
    // Must not use season PA from settings (900)
    expect(alpha.pointsAgainst).not.toBe(900);
    expect(alpha.weeklyScores.map((w) => w.week)).toEqual([1, 2, 3]);
    expect(alpha.weeklyScores.map((w) => w.score)).toEqual([110, 95, 120]);
    // Must not leak current 8–2
    expect(alpha.wins).not.toBe(8);
    expect(alpha.losses).not.toBe(2);
  });

  it("does not source W/L from roster.settings when matchups are empty through week", () => {
    const { teams } = buildTeamsFromMatchupData({
      leagueName: "Empty",
      throughWeek: 3,
      rosters: [
        {
          roster_id: 1,
          owner_id: "u1",
          settings: { wins: 8, losses: 2 },
        },
      ],
      users: [{ user_id: "u1", display_name: "Alpha" }],
      matchupsByWeek: {},
    });
    expect(teams[0]!.wins).toBe(0);
    expect(teams[0]!.losses).toBe(0);
    expect(teams[0]!.pointsFor).toBe(0);
    expect(teams[0]!.pointsAgainst).toBe(0);
  });
});
