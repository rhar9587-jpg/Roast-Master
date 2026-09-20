import { describe, expect, it } from "vitest";
import {
  nflWeekContextFromState,
  resolveFinalThroughWeek,
} from "./nflState";
import { buildTeamsFromMatchupData } from "../lib/weeklyCommissioner";

describe("nflWeekContextFromState", () => {
  it("treats display_week as preview and previous week as latest final", () => {
    const ctx = nflWeekContextFromState({
      week: 5,
      display_week: 5,
      leg: 5,
      season: "2026",
      season_type: "regular",
    });
    expect(ctx.previewWeek).toBe(5);
    expect(ctx.latestFinalWeek).toBe(4);
    expect(ctx.recapWeek).toBe(4);
  });

  it("uses latestFinalWeek 0 while week 1 is in progress", () => {
    const ctx = nflWeekContextFromState({ display_week: 1, week: 1 });
    expect(ctx.previewWeek).toBe(1);
    expect(ctx.latestFinalWeek).toBe(0);
    expect(ctx.recapWeek).toBe(1); // UI default still ≥ 1
  });
});

describe("resolveFinalThroughWeek", () => {
  it("keeps historical through-weeks fully final", () => {
    expect(resolveFinalThroughWeek(3, 10)).toBe(3);
  });

  it("caps a live through-week at the latest final NFL week", () => {
    expect(resolveFinalThroughWeek(5, 4)).toBe(4);
  });
});

describe("production standings integration (finalThroughWeek from NFL context)", () => {
  /**
   * Simulates the production path:
   * buildTeamsFromSleeper(leagueId, currentWeek) → resolveFinalThroughWeek(current, latestFinal)
   * → buildTeamsFromMatchupData({ throughWeek: current, finalThroughWeek: latestFinal })
   */
  it("does not create W/L from partial non-zero scores on the live current week", () => {
    const currentWeek = 4;
    const latestFinalWeek = 3; // previous week is the latest confirmed complete
    const finalThroughWeek = resolveFinalThroughWeek(currentWeek, latestFinalWeek);
    expect(finalThroughWeek).toBe(3);

    const rosters = [
      {
        roster_id: 1,
        owner_id: "u1",
        settings: { wins: 3, losses: 0 }, // misleading live settings
      },
      { roster_id: 2, owner_id: "u2", settings: { wins: 0, losses: 3 } },
    ];
    const users = [
      { user_id: "u1", display_name: "Alpha" },
      { user_id: "u2", display_name: "Beta" },
    ];

    const matchupsByWeek = {
      1: [
        { matchup_id: 1, roster_id: 1, points: 100 },
        { matchup_id: 1, roster_id: 2, points: 90 },
      ],
      2: [
        { matchup_id: 1, roster_id: 1, points: 110 },
        { matchup_id: 1, roster_id: 2, points: 95 },
      ],
      3: [
        { matchup_id: 1, roster_id: 1, points: 105 },
        { matchup_id: 1, roster_id: 2, points: 100 },
      ],
      // Live week 4: partial non-zero scores (Sunday afternoon)
      4: [
        { matchup_id: 1, roster_id: 1, points: 48.5 },
        { matchup_id: 1, roster_id: 2, points: 32.0 },
      ],
    };

    const { teams } = buildTeamsFromMatchupData({
      leagueName: "Live League",
      throughWeek: currentWeek,
      finalThroughWeek,
      rosters,
      users,
      matchupsByWeek,
    });

    const alpha = teams.find((t) => t.teamId === "1")!;
    // Standings / power input stop at week 3 (3–0), not 4–0 from partial week 4
    expect(alpha.wins).toBe(3);
    expect(alpha.losses).toBe(0);
    expect(alpha.pointsFor).toBe(100 + 110 + 105);
    expect(alpha.pointsAgainst).toBe(90 + 95 + 100);
    expect(alpha.weeklyScores.map((w) => w.week)).toEqual([1, 2, 3]);
    expect(alpha.weeklyScores.find((w) => w.week === 4)).toBeUndefined();
    // Must not treat partial 48.5 as a completed win
    expect(alpha.wins).not.toBe(4);
  });
});
