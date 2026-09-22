import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createMemoryRankingBackend,
  getStoredPreviousRankings,
  __setRankingHistoryBackendForTests,
  __resetRankingHistoryModuleForTests,
} from "./weeklyRankingsStore";
import { generatePowerRankings, type PowerRankingsTeamInput } from "./powerRankings";
import { resolvePriorRankingsForWeek } from "./weeklyCommissioner";
import { formatRankMovementLabel } from "@shared/rankMovement";

function team(
  id: string,
  name: string,
  wins: number,
  losses: number,
  pf: number,
  throughWeek: number,
): PowerRankingsTeamInput {
  return {
    teamId: id,
    teamName: name,
    wins,
    losses,
    pointsFor: pf,
    weeklyScores: Array.from({ length: throughWeek }, (_, i) => ({
      week: i + 1,
      score: pf / Math.max(1, throughWeek),
    })),
  };
}

describe("resolvePriorRankingsForWeek bootstrap", () => {
  beforeEach(() => {
    __setRankingHistoryBackendForTests(createMemoryRankingBackend());
  });

  afterEach(() => {
    __resetRankingHistoryModuleForTests();
  });

  it("returns [] for week 1 (no prior trend)", async () => {
    const prior = await resolvePriorRankingsForWeek({
      leagueId: "lg-boot",
      week: 1,
      season: "2025",
      loadPriorWeekTeams: async () => {
        throw new Error("should not load for week 1");
      },
    });
    expect(prior).toEqual([]);
  });

  it("uses durable store when a prior snapshot already exists", async () => {
    let loads = 0;
    const first = await resolvePriorRankingsForWeek({
      leagueId: "lg-boot",
      week: 2,
      season: "2025",
      loadPriorWeekTeams: async () => {
        loads += 1;
        return {
          teams: [
            team("1", "Alice", 1, 0, 120, 1),
            team("2", "Bob", 0, 1, 90, 1),
          ],
          season: "2025",
        };
      },
    });
    expect(loads).toBe(1);
    expect(first.length).toBe(2);

    const fromStore = await resolvePriorRankingsForWeek({
      leagueId: "lg-boot",
      week: 2,
      season: "2025",
      loadPriorWeekTeams: async () => {
        loads += 1;
        return { teams: [], season: "2025" };
      },
    });
    expect(fromStore).toEqual(first);
    expect(loads).toBe(1);
  });

  it("explicitPrior short-circuits store and bootstrap", async () => {
    let loads = 0;
    const explicit = [
      { teamId: "1", rank: 2 },
      { teamId: "2", rank: 1 },
    ];
    const prior = await resolvePriorRankingsForWeek({
      leagueId: "lg-explicit",
      week: 2,
      season: "2025",
      explicitPrior: explicit,
      loadPriorWeekTeams: async () => {
        loads += 1;
        return { teams: [], season: "2025" };
      },
    });
    expect(prior).toEqual(explicit);
    expect(loads).toBe(0);
  });

  it("empty store + Week 2 bootstraps week-1 rankings and enables ↑/↓/Same", async () => {
    const week1Teams = [
      team("1", "Alice", 1, 0, 140, 1),
      team("2", "Bob", 1, 0, 110, 1),
      team("3", "Carol", 0, 1, 95, 1),
      team("4", "Dave", 0, 1, 70, 1),
    ];
    const week2Teams = [
      // Alice cooling off; Dave surging — order will flip vs week 1.
      team("1", "Alice", 1, 1, 200, 2),
      team("2", "Bob", 2, 0, 230, 2),
      team("3", "Carol", 1, 1, 180, 2),
      team("4", "Dave", 1, 1, 210, 2),
    ];

    const prior = await resolvePriorRankingsForWeek({
      leagueId: "lg-blank-trend",
      week: 2,
      season: "2025",
      loadPriorWeekTeams: async (priorWeek) => {
        expect(priorWeek).toBe(1);
        return { teams: week1Teams, season: "2025" };
      },
    });

    expect(prior.length).toBe(4);
    // Bootstrap must persist so the next Week-2 request reads from store.
    const stored = await getStoredPreviousRankings("lg-blank-trend", 2, "2025");
    expect(stored.map((r) => ({ teamId: r.teamId, rank: r.rank }))).toEqual(prior);

    const week2 = generatePowerRankings(week2Teams, prior);
    expect(week2.every((r) => r.showMovement === true)).toBe(true);
    expect(week2.every((r) => r.previousRank != null)).toBe(true);

    const labels = week2.map((r) =>
      formatRankMovementLabel({
        state: r.trend === "up" ? "up" : r.trend === "down" ? "down" : "same",
        places: r.placesMoved,
      }),
    );
    // At least one non-empty movement label (↑ N / ↓ N / Same) — TREND not blank.
    expect(labels.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
    expect(labels.some((l) => l.startsWith("↑") || l.startsWith("↓") || l === "Same")).toBe(true);

    // Second call hits store — no re-bootstrap.
    let loads = 0;
    const again = await resolvePriorRankingsForWeek({
      leagueId: "lg-blank-trend",
      week: 2,
      season: "2025",
      loadPriorWeekTeams: async () => {
        loads += 1;
        return { teams: week1Teams, season: "2025" };
      },
    });
    expect(loads).toBe(0);
    expect(again).toEqual(prior);
  });

  it("returns [] when bootstrap cannot load prior-week teams", async () => {
    const prior = await resolvePriorRankingsForWeek({
      leagueId: "lg-empty",
      week: 2,
      season: "2025",
      loadPriorWeekTeams: async () => ({ teams: [], season: "2025" }),
    });
    expect(prior).toEqual([]);
  });
});
