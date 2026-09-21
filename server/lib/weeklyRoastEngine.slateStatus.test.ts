import { describe, expect, it } from "vitest";
import { buildWeeklyRoastNarrative } from "./weeklyRoastEngine";

const scoredFinal = [
  { matchup_id: 1, roster_id: 1, points: 142.3 },
  { matchup_id: 1, roster_id: 2, points: 98.1 },
  { matchup_id: 2, roster_id: 3, points: 110.0 },
  { matchup_id: 2, roster_id: 4, points: 101.5 },
];

const allZero = [
  { matchup_id: 1, roster_id: 1, points: 0 },
  { matchup_id: 1, roster_id: 2, points: 0 },
  { matchup_id: 2, roster_id: 3, points: 0 },
  { matchup_id: 2, roster_id: 4, points: 0 },
];

const livePartial = [
  { matchup_id: 1, roster_id: 1, points: 48.5 },
  { matchup_id: 1, roster_id: 2, points: 32.0 },
];

describe("buildWeeklyRoastNarrative week slate correctness", () => {
  it("completed week with real final scores → recap allowed", async () => {
    const n = await buildWeeklyRoastNarrative({
      league: { league_id: "x", name: "NFL Downunder", season: "2026" },
      week: 2,
      matchups: scoredFinal,
      rosterName: (rid) => (rid === 1 ? "Harks9" : `T${rid}`),
      weekIsFinal: true,
    });
    expect(n.signals.recapReady).toBe(true);
    expect(n.signals.slateStatus).toBe("final");
    expect(n.headline.toLowerCase()).toMatch(/harks9|feasted|dealt|slate|box scores/);
    expect(n.cards.some((c) => c.type === "top_dog")).toBe(true);
  });

  it("future 0–0 matchup → not completed / no ran the slate", async () => {
    const n = await buildWeeklyRoastNarrative({
      league: { league_id: "x", name: "NFL Downunder", season: "2026" },
      week: 3,
      matchups: allZero,
      rosterName: (rid) => (rid === 1 ? "Harks9" : `T${rid}`),
      weekIsFinal: false,
    });
    expect(n.signals.recapReady).toBe(false);
    expect(n.signals.slateStatus).toBe("upcoming");
    expect(n.headline.toLowerCase()).not.toContain("ran the slate");
    expect(n.cards.some((c) => c.type === "top_dog")).toBe(false);
  });

  it("live matchup → not completed", async () => {
    const n = await buildWeeklyRoastNarrative({
      league: { league_id: "x", name: "NFL Downunder", season: "2026" },
      week: 3,
      matchups: livePartial,
      rosterName: (rid) => `T${rid}`,
      weekIsFinal: false,
    });
    expect(n.signals.recapReady).toBe(false);
    expect(n.signals.slateStatus).toBe("live");
    expect(n.headline.toLowerCase()).toContain("live");
    expect(n.cards.some((c) => c.type === "top_dog")).toBe(false);
  });

  it("all-zero unavailable (calendar final) → not completed / no crowns", async () => {
    const n = await buildWeeklyRoastNarrative({
      league: { league_id: "x", name: "NFL Downunder", season: "2026" },
      week: 3,
      matchups: allZero,
      rosterName: (rid) => (rid === 1 ? "Harks9" : `T${rid}`),
      weekIsFinal: true,
    });
    expect(n.signals.recapReady).toBe(false);
    expect(n.signals.slateStatus).toBe("unavailable");
    expect(n.headline.toLowerCase()).not.toContain("ran the slate");
    expect(n.headline.toLowerCase()).not.toContain("feasted");
    expect(n.cards.some((c) => c.type === "top_dog")).toBe(false);
    expect(n.groupChatSummary.toLowerCase()).toContain("not a completed recap");
  });
});
