import { describe, expect, it } from "vitest";
import { resolveWeekSlateStatus, isWeekSlateRecapReady } from "./weekSlateStatus";

const finalScored = [
  { matchup_id: 1, roster_id: 1, points: 120.5 },
  { matchup_id: 1, roster_id: 2, points: 99.0 },
];

const futureShell = [
  { matchup_id: 1, roster_id: 1, points: 0 },
  { matchup_id: 1, roster_id: 2, points: 0 },
];

const livePartial = [
  { matchup_id: 1, roster_id: 1, points: 48.5 },
  { matchup_id: 1, roster_id: 2, points: 32.0 },
];

describe("resolveWeekSlateStatus", () => {
  it("completed week with real final scores → final (recap allowed)", () => {
    const r = resolveWeekSlateStatus({ weekIsFinal: true, matchups: finalScored });
    expect(r.status).toBe("final");
    expect(r.hasFinalPlayedGames).toBe(true);
    expect(isWeekSlateRecapReady(r.status)).toBe(true);
  });

  it("future 0–0 matchup → not completed", () => {
    const r = resolveWeekSlateStatus({ weekIsFinal: false, matchups: futureShell });
    expect(r.status).toBe("upcoming");
    expect(isWeekSlateRecapReady(r.status)).toBe(false);
  });

  it("live matchup → not completed", () => {
    const r = resolveWeekSlateStatus({ weekIsFinal: false, matchups: livePartial });
    expect(r.status).toBe("live");
    expect(isWeekSlateRecapReady(r.status)).toBe(false);
  });

  it("all-zero unavailable data (calendar final, no played scores) → not completed", () => {
    const r = resolveWeekSlateStatus({ weekIsFinal: true, matchups: futureShell });
    expect(r.status).toBe("unavailable");
    expect(r.hasFinalPlayedGames).toBe(false);
    expect(isWeekSlateRecapReady(r.status)).toBe(false);
  });

  it("missing matchups → unavailable", () => {
    expect(resolveWeekSlateStatus({ weekIsFinal: true, matchups: [] }).status).toBe(
      "unavailable",
    );
    expect(resolveWeekSlateStatus({ weekIsFinal: true, matchups: null }).status).toBe(
      "unavailable",
    );
  });
});
