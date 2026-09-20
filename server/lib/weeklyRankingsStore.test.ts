import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createMemoryRankingBackend,
  getStoredPreviousRankings,
  storeRankingsForWeek,
  __setRankingHistoryBackendForTests,
  __resetRankingHistoryModuleForTests,
  type RankingHistoryBackend,
} from "./weeklyRankingsStore";
import { generatePowerRankings, type PowerRankingsTeamInput } from "./powerRankings";

function team(
  id: string,
  name: string,
  wins: number,
  losses: number,
  pf: number,
): PowerRankingsTeamInput {
  return {
    teamId: id,
    teamName: name,
    wins,
    losses,
    pointsFor: pf,
    weeklyScores: Array.from({ length: wins + losses }, (_, i) => ({
      week: i + 1,
      score: pf / Math.max(1, wins + losses),
    })),
  };
}

describe("weekly ranking history persistence", () => {
  let backend: ReturnType<typeof createMemoryRankingBackend>;

  beforeEach(() => {
    backend = createMemoryRankingBackend();
    __setRankingHistoryBackendForTests(backend);
  });

  afterEach(() => {
    __resetRankingHistoryModuleForTests();
  });

  it("Week 4 persisted → Week 5 reads Week 4 ranking", async () => {
    await storeRankingsForWeek(
      "lg-a",
      4,
      [
        { teamId: "1", rank: 1, powerScore: 90 },
        { teamId: "2", rank: 2, powerScore: 70 },
      ],
      "2024",
    );
    const prev = await getStoredPreviousRankings("lg-a", 5, "2024");
    expect(prev).toEqual([
      { teamId: "1", rank: 1, powerScore: 90 },
      { teamId: "2", rank: 2, powerScore: 70 },
    ]);
  });

  it("process-memory reset simulation does not lose previous rankings", async () => {
    await storeRankingsForWeek(
      "lg-a",
      4,
      [{ teamId: "1", rank: 1 }],
      "2024",
    );
    // Simulate restart: module flags reset, but durable dump is reloaded into a fresh backend.
    const durable = backend._dump();
    __resetRankingHistoryModuleForTests();
    const restarted = createMemoryRankingBackend();
    restarted._load(durable);
    __setRankingHistoryBackendForTests(restarted);

    const prev = await getStoredPreviousRankings("lg-a", 5, "2024");
    expect(prev).toEqual([{ teamId: "1", rank: 1 }]);

    const teams = [
      team("1", "Alpha", 5, 0, 600),
      team("2", "Beta", 0, 5, 400),
    ];
    const week5 = generatePowerRankings(teams, prev);
    expect(week5.find((r) => r.teamId === "1")?.trend).toBe("flat");
  });

  it("league A never reads league B history", async () => {
    await storeRankingsForWeek("league-a", 3, [{ teamId: "1", rank: 1 }], "2024");
    await storeRankingsForWeek("league-b", 3, [{ teamId: "1", rank: 8 }], "2024");
    const prev = await getStoredPreviousRankings("league-a", 4, "2024");
    expect(prev).toEqual([{ teamId: "1", rank: 1 }]);
  });

  it("season A does not leak into season B", async () => {
    await storeRankingsForWeek("lg", 10, [{ teamId: "1", rank: 1 }], "2023");
    await storeRankingsForWeek("lg", 1, [{ teamId: "1", rank: 5 }], "2024");
    const prev = await getStoredPreviousRankings("lg", 2, "2024");
    expect(prev).toEqual([{ teamId: "1", rank: 5 }]);
    expect(prev.find((r) => r.rank === 1)).toBeUndefined();
  });

  it("rerunning same week is idempotent", async () => {
    await storeRankingsForWeek("lg", 6, [{ teamId: "1", rank: 3 }], "2024");
    await storeRankingsForWeek("lg", 6, [{ teamId: "1", rank: 1 }, { teamId: "2", rank: 2 }], "2024");
    const prev = await getStoredPreviousRankings("lg", 7, "2024");
    expect(prev).toHaveLength(2);
    expect(prev.find((r) => r.teamId === "1")?.rank).toBe(1);
  });

  it("same display name / different roster IDs stay separate", async () => {
    await storeRankingsForWeek(
      "lg",
      2,
      [
        { teamId: "10", rank: 1 },
        { teamId: "20", rank: 2 },
      ],
      "2024",
    );
    const prev = await getStoredPreviousRankings("lg", 3, "2024");
    expect(prev.map((r) => r.teamId).sort()).toEqual(["10", "20"]);
    // Joins are by teamId — identical display names do not merge rows.
    const teams = [
      team("10", "Same Name", 3, 0, 400),
      team("20", "Same Name", 0, 3, 200),
    ];
    const rows = generatePowerRankings(teams, prev);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.teamId === "10")?.rank).toBe(1);
    expect(rows.find((r) => r.teamId === "20")?.rank).toBe(2);
    expect(rows.find((r) => r.teamId === "10")?.trend).toBe("flat");
    expect(rows.find((r) => r.teamId === "20")?.trend).toBe("flat");
  });

  it("renamed team with same roster ID keeps trend continuity", async () => {
    await storeRankingsForWeek("lg", 4, [{ teamId: "7", rank: 4 }], "2024");
    const prev = await getStoredPreviousRankings("lg", 5, "2024");
    const teams = [
      team("7", "New Display Name", 5, 0, 700),
      team("8", "Other", 0, 5, 300),
    ];
    const rows = generatePowerRankings(teams, prev);
    const renamed = rows.find((r) => r.teamId === "7")!;
    expect(renamed.teamName).toBe("New Display Name");
    expect(renamed.rank).toBe(1);
    expect(renamed.trend).toBe("up"); // was 4th, now 1st
  });

  it("no previous snapshot → flat/unknown conservative behaviour", async () => {
    const prev = await getStoredPreviousRankings("lg-empty", 3, "2024");
    expect(prev).toEqual([]);
    const rows = generatePowerRankings([team("1", "Solo", 2, 0, 200)], prev);
    expect(rows[0]!.trend).toBe("flat");
  });

  it("storage read failure does not invent movement", async () => {
    const failing: RankingHistoryBackend = {
      async getLatestBefore() {
        throw new Error("disk read failed");
      },
      async upsertWeek() {},
    };
    __setRankingHistoryBackendForTests(failing);
    const prev = await getStoredPreviousRankings("lg", 5, "2024");
    expect(prev).toEqual([]);
    const rows = generatePowerRankings(
      [team("1", "A", 3, 0, 300), team("2", "B", 0, 3, 100)],
      prev,
    );
    expect(rows.every((r) => r.trend === "flat")).toBe(true);
  });

  it("storage write failure does not break current ranking response", async () => {
    const failing: RankingHistoryBackend = {
      async getLatestBefore() {
        return [];
      },
      async upsertWeek() {
        throw new Error("disk write failed");
      },
    };
    __setRankingHistoryBackendForTests(failing);
    await expect(
      storeRankingsForWeek("lg", 3, [{ teamId: "1", rank: 1 }], "2024"),
    ).resolves.toBeUndefined();
    const rows = generatePowerRankings([team("1", "A", 1, 0, 100)], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rank).toBe(1);
  });

  it("latest strictly before Week N skips missing intermediate weeks", async () => {
    await storeRankingsForWeek("lg", 2, [{ teamId: "1", rank: 3 }], "2024");
    await storeRankingsForWeek("lg", 4, [{ teamId: "1", rank: 1 }], "2024");
    // Week 5 should use week 4 (latest before 5), not week 2
    const prev = await getStoredPreviousRankings("lg", 5, "2024");
    expect(prev).toEqual([{ teamId: "1", rank: 1 }]);
  });
});
