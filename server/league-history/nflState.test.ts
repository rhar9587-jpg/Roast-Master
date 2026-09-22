import { describe, expect, it } from "vitest";
import {
  nflWeekContextFromState,
  resolveFinalThroughWeek,
  isLeagueWeekFinal,
  resolveLeagueWeekFinality,
} from "./nflState";
import { buildTeamsFromMatchupData, buildIntroSummary } from "../lib/weeklyCommissioner";
import {
  matchupFinalityTruth,
  pickLargestMarginWinner,
  pickStoleOneAndGotRobbed,
} from "../lib/domain/matchupOutcomes";
import { resolveWeekSlateStatus } from "../lib/domain/weekSlateStatus";
import { buildWeeklyRoastNarrative } from "../lib/weeklyRoastEngine";
import type { PowerRankingRow } from "../lib/powerRankings";

describe("nflWeekContextFromState", () => {
  it("normal aligned state: week/leg/display agree → latestFinal = preview - 1", () => {
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

  it("Week 1 still active → latestFinalWeek 0", () => {
    const ctx = nflWeekContextFromState({
      week: 1,
      leg: 1,
      display_week: 1,
      season: "2026",
    });
    expect(ctx.previewWeek).toBe(1);
    expect(ctx.latestFinalWeek).toBe(0);
    expect(ctx.recapWeek).toBe(1); // UI default still ≥ 1
  });

  /**
   * Lagging display_week (live Downunder Week 2 bug):
   * Sleeper week/leg already at 3 while display_week still says 2.
   * Finality must advance from week/leg — display must not hold latestFinalWeek at 1.
   */
  it("lagging display_week does not hold latestFinalWeek back", () => {
    const ctx = nflWeekContextFromState({
      week: 3,
      leg: 3,
      display_week: 2,
      season: "2026",
      season_type: "regular",
    });
    expect(ctx.previewWeek).toBe(2); // display still used for presentation
    expect(ctx.latestFinalWeek).toBe(2);
    expect(ctx.recapWeek).toBe(2);
    expect(resolveLeagueWeekFinality(2, "2026", ctx)).toBe(true);
    expect(resolveLeagueWeekFinality(3, "2026", ctx)).toBe(false);
  });

  /**
   * Intended rule when display_week leads week/leg:
   * display_week may drive preview labeling, but must NOT advance calendar
   * finality ahead of week/leg. Otherwise the current NFL week could be
   * crowned final while Sleeper week/leg still say it is in progress.
   */
  it("leading display_week does not advance finality ahead of week/leg", () => {
    const ctx = nflWeekContextFromState({
      week: 3,
      leg: 3,
      display_week: 4,
      season: "2026",
    });
    expect(ctx.previewWeek).toBe(4);
    expect(ctx.latestFinalWeek).toBe(2);
    expect(ctx.recapWeek).toBe(2);
    expect(resolveLeagueWeekFinality(3, "2026", ctx)).toBe(false);
  });

  it("ignores invalid week fields so they cannot advance finality", () => {
    const ctx = nflWeekContextFromState({
      week: 0,
      leg: 3,
      display_week: 99,
      season: "2026",
    });
    // invalid week(0) ignored; invalid display(99) ignored for progression;
    // valid leg=3 → latestFinal=2. preview falls back past invalid display to week/leg.
    expect(ctx.latestFinalWeek).toBe(2);
    expect(ctx.previewWeek).toBe(3);
  });

  it("falls back to display_week for finality only when week and leg are absent", () => {
    const ctx = nflWeekContextFromState({ display_week: 5, season: "2026" });
    expect(ctx.previewWeek).toBe(5);
    expect(ctx.latestFinalWeek).toBe(4);
  });
});

describe("Week 2 end-to-end finality (Downunder-style)", () => {
  const week2Scored = [
    { matchup_id: 1, roster_id: 1, points: 140.56 },
    { matchup_id: 1, roster_id: 2, points: 98.1 },
    { matchup_id: 2, roster_id: 3, points: 110.0 },
    { matchup_id: 2, roster_id: 4, points: 101.5 },
    { matchup_id: 3, roster_id: 5, points: 88.2 },
    { matchup_id: 3, roster_id: 6, points: 60.12 },
  ];
  const week3Shells = [
    { matchup_id: 1, roster_id: 1, points: 0 },
    { matchup_id: 1, roster_id: 2, points: 0 },
    { matchup_id: 2, roster_id: 3, points: 0 },
    { matchup_id: 2, roster_id: 4, points: 0 },
  ];
  const livePartial = [
    { matchup_id: 1, roster_id: 1, points: 48.5 },
    { matchup_id: 1, roster_id: 2, points: 32.0 },
  ];

  it("Week 2 is final/recapReady when NFL week/leg are at 3 despite lagging display_week", async () => {
    const nfl = nflWeekContextFromState({
      week: 3,
      leg: 3,
      display_week: 2,
      season: "2026",
    });
    expect(nfl.latestFinalWeek).toBe(2);
    const weekIsFinal = resolveLeagueWeekFinality(2, "2026", nfl);
    expect(weekIsFinal).toBe(true);

    const slate = resolveWeekSlateStatus({ weekIsFinal, matchups: week2Scored });
    expect(slate.status).toBe("final");

    const narrative = await buildWeeklyRoastNarrative({
      league: { league_id: "1389437091309432832", name: "NFL Downunder", season: "2026" },
      week: 2,
      matchups: week2Scored,
      rosterName: (rid) => (rid === 1 ? "Harks9" : `T${rid}`),
      weekIsFinal,
    });
    expect(narrative.signals.weekIsFinal).toBe(true);
    expect(narrative.signals.slateStatus).toBe("final");
    expect(narrative.signals.recapReady).toBe(true);
    expect(narrative.cards.some((c) => c.type === "top_dog")).toBe(true);
  });

  it("live mid-week: nonzero scores + current week still open stay live / not recapReady", async () => {
    const nfl = nflWeekContextFromState({
      week: 3,
      leg: 3,
      display_week: 3,
      season: "2026",
    });
    expect(nfl.latestFinalWeek).toBe(2);
    const weekIsFinal = resolveLeagueWeekFinality(3, "2026", nfl);
    expect(weekIsFinal).toBe(false);

    const slate = resolveWeekSlateStatus({ weekIsFinal, matchups: livePartial });
    expect(slate.status).toBe("live");

    const narrative = await buildWeeklyRoastNarrative({
      league: { league_id: "1389437091309432832", name: "NFL Downunder", season: "2026" },
      week: 3,
      matchups: livePartial,
      rosterName: (rid) => `T${rid}`,
      weekIsFinal,
    });
    expect(narrative.signals.weekIsFinal).toBe(false);
    expect(narrative.signals.slateStatus).toBe("live");
    expect(narrative.signals.recapReady).toBe(false);
    expect(narrative.cards.some((c) => c.type === "top_dog")).toBe(false);
  });

  it("future/upcoming: Week 3 all-0 shells while Week 3 is current stay upcoming", async () => {
    const nfl = nflWeekContextFromState({
      week: 3,
      leg: 3,
      display_week: 3,
      season: "2026",
    });
    const weekIsFinal = resolveLeagueWeekFinality(3, "2026", nfl);
    expect(weekIsFinal).toBe(false);

    const slate = resolveWeekSlateStatus({ weekIsFinal, matchups: week3Shells });
    expect(slate.status).toBe("upcoming");

    const narrative = await buildWeeklyRoastNarrative({
      league: { league_id: "1389437091309432832", name: "NFL Downunder", season: "2026" },
      week: 3,
      matchups: week3Shells,
      rosterName: (rid) => `T${rid}`,
      weekIsFinal,
    });
    expect(narrative.signals.slateStatus).toBe("upcoming");
    expect(narrative.signals.recapReady).toBe(false);
    expect(narrative.cards.some((c) => c.type === "top_dog")).toBe(false);
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

describe("isLeagueWeekFinal", () => {
  const nfl = { season: "2026", latestFinalWeek: 4 };

  it("treats past league seasons as fully final", () => {
    expect(isLeagueWeekFinal(17, "2025", nfl)).toBe(true);
  });

  it("treats future league seasons as not final", () => {
    expect(isLeagueWeekFinal(1, "2027", nfl)).toBe(false);
  });

  it("uses latestFinalWeek for the current season", () => {
    expect(isLeagueWeekFinal(4, "2026", nfl)).toBe(true);
    expect(isLeagueWeekFinal(5, "2026", nfl)).toBe(false);
  });
});

describe("resolveLeagueWeekFinality", () => {
  const livePartial = [
    { matchup_id: 1, roster_id: 1, points: 48.5 },
    { matchup_id: 1, roster_id: 2, points: 32.0 },
  ];
  const historicalCompleted = [
    { matchup_id: 1, roster_id: 1, points: 120.5 },
    { matchup_id: 1, roster_id: 2, points: 99.0 },
  ];

  it("returns false when NFL state is unavailable (never invent current-season W/L)", () => {
    expect(resolveLeagueWeekFinality(5, "2026", null)).toBe(false);
    expect(resolveLeagueWeekFinality(5, "2026", undefined)).toBe(false);
  });

  it("keeps historical past seasons final when NFL context is present", () => {
    const nfl = { season: "2026", latestFinalWeek: 4 };
    expect(resolveLeagueWeekFinality(12, "2024", nfl)).toBe(true);
  });

  it("Wrapped/Autopsy: unavailable NFL + live partial scores do not assign winners", () => {
    // Same path wrapped/autopsy use: resolveLeagueWeekFinality → classifier consumers
    const weekIsFinal = resolveLeagueWeekFinality(5, "2026", null);
    expect(weekIsFinal).toBe(false);

    const truth = matchupFinalityTruth(livePartial[0]!, livePartial[1]!, { weekIsFinal });
    expect(truth.hasWinner).toBe(false);
    expect(truth.hasNoFinalResult).toBe(true);

    // Autopsy blowout / wrapped W-L both key off completed winners
    expect(pickLargestMarginWinner(livePartial, { weekIsFinal })).toBeNull();
    expect(pickStoleOneAndGotRobbed(livePartial, { weekIsFinal })).toBeNull();
  });

  it("historical completed season behaviour remains intact with NFL context", () => {
    const nfl = { season: "2026", latestFinalWeek: 4 };
    const weekIsFinal = resolveLeagueWeekFinality(8, "2024", nfl);
    expect(weekIsFinal).toBe(true);

    const truth = matchupFinalityTruth(
      historicalCompleted[0]!,
      historicalCompleted[1]!,
      { weekIsFinal },
    );
    expect(truth).toMatchObject({
      hasWinner: true,
      isTie: false,
      hasNoFinalResult: false,
      winnerRosterId: 1,
    });
    expect(pickLargestMarginWinner(historicalCompleted, { weekIsFinal })?.winnerRosterId).toBe(1);
  });
});

describe("buildIntroSummary finality wording", () => {
  const rankings = [
    {
      teamId: "1",
      teamName: "Alpha",
      rank: 1,
      previousRank: 1,
      powerScore: 90,
      expectedWins: 3,
      luckDelta: 0,
      commentary: "Solid.",
    },
  ] as PowerRankingRow[];

  it("says the week is in the books when final", () => {
    expect(buildIntroSummary(4, rankings, true)).toMatch(/^Week 4 is in the books\./);
  });

  it("says the week hasn't kicked off when upcoming (not underway)", () => {
    expect(
      buildIntroSummary(5, rankings, { slateStatus: "upcoming", recapReady: false }),
    ).toMatch(/hasn't kicked off yet/);
    expect(
      buildIntroSummary(5, rankings, { slateStatus: "upcoming", recapReady: false }),
    ).not.toMatch(/underway/);
    expect(
      buildIntroSummary(5, rankings, { slateStatus: "upcoming", recapReady: false }),
    ).not.toMatch(/in the books/);
  });

  it("says live when slate is live", () => {
    expect(
      buildIntroSummary(5, rankings, { slateStatus: "live", recapReady: false }),
    ).toMatch(/is live/);
    expect(
      buildIntroSummary(5, rankings, { slateStatus: "live", recapReady: false }),
    ).not.toMatch(/underway|in the books|results/);
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
