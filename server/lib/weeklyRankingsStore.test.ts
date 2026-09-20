import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  createMemoryRankingBackend,
  createFileRankingBackend,
  createNoopRankingBackend,
  createPostgresRankingBackend,
  getStoredPreviousRankings,
  storeRankingsForWeek,
  resolveRankingBackendKind,
  isProductionRankingRuntime,
  WEEKLY_RANKINGS_FILE_PATH,
  __setRankingHistoryBackendForTests,
  __setRankingHistoryEnvForTests,
  __resetRankingHistoryModuleForTests,
  __getActiveRankingBackendKindForTests,
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

describe("production vs development ranking backend selection", () => {
  afterEach(() => {
    __resetRankingHistoryModuleForTests();
  });

  it("production + Postgres available → postgres backend kind", () => {
    expect(
      resolveRankingBackendKind({ isProduction: true, postgresAvailable: true }),
    ).toBe("postgres");
    expect(isProductionRankingRuntime({ NODE_ENV: "production" })).toBe(true);
    // createPostgresRankingBackend marks kind correctly (pool unused in this assertion)
    const fakePool = {} as import("pg").Pool;
    expect(createPostgresRankingBackend(fakePool).kind).toBe("postgres");
  });

  it("production + Postgres unavailable → previous rankings empty / conservative", async () => {
    __setRankingHistoryBackendForTests(null);
    __setRankingHistoryEnvForTests({ NODE_ENV: "production" }); // no DATABASE_URL
    const kind = await __getActiveRankingBackendKindForTests();
    expect(kind).toBe("noop");
    const prev = await getStoredPreviousRankings("lg-prod", 5, "2024");
    expect(prev).toEqual([]);
    const rows = generatePowerRankings(
      [team("1", "A", 4, 0, 400), team("2", "B", 0, 4, 100)],
      prev,
    );
    expect(rows.every((r) => r.trend === "flat")).toBe(true);
  });

  it("production + Postgres unavailable → ranking write does not fail the request", async () => {
    __setRankingHistoryBackendForTests(createNoopRankingBackend());
    await expect(
      storeRankingsForWeek("lg-prod", 4, [{ teamId: "1", rank: 1, powerScore: 88 }], "2024"),
    ).resolves.toBeUndefined();
    const prev = await getStoredPreviousRankings("lg-prod", 5, "2024");
    expect(prev).toEqual([]);
  });

  it("production does not write .data/weekly-rankings.json", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rank-prod-"));
    const probePath = path.join(tmpRoot, "weekly-rankings.json");
    __setRankingHistoryBackendForTests(createNoopRankingBackend());
    __setRankingHistoryEnvForTests({ NODE_ENV: "production" });
    await storeRankingsForWeek("lg-prod", 3, [{ teamId: "9", rank: 1 }], "2024");
    await expect(fs.access(probePath)).rejects.toThrow();
    await expect(fs.access(WEEKLY_RANKINGS_FILE_PATH)).rejects.toThrow();
    expect(createNoopRankingBackend().kind).toBe("noop");
  });

  it("local development may use the file backend", () => {
    expect(
      resolveRankingBackendKind({ isProduction: false, postgresAvailable: false }),
    ).toBe("file");
    expect(isProductionRankingRuntime({ NODE_ENV: "development" })).toBe(false);
    expect(createFileRankingBackend().kind).toBe("file");
  });

  it("development init without DATABASE_URL selects file backend", async () => {
    __setRankingHistoryBackendForTests(null);
    __setRankingHistoryEnvForTests({ NODE_ENV: "development" });
    const kind = await __getActiveRankingBackendKindForTests();
    expect(kind).toBe("file");
  });
});

describe("local file backend concurrency", () => {
  let tmpFile: string;

  beforeEach(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rank-file-"));
    tmpFile = path.join(dir, "weekly-rankings.json");
  });

  afterEach(async () => {
    __resetRankingHistoryModuleForTests();
    try {
      await fs.rm(path.dirname(tmpFile), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("concurrent local writes do not erase unrelated snapshots", async () => {
    const fileBackend = createFileRankingBackend(tmpFile);
    __setRankingHistoryBackendForTests(fileBackend);

    await Promise.all([
      storeRankingsForWeek("lg-a", 1, [{ teamId: "1", rank: 1 }], "2024"),
      storeRankingsForWeek("lg-b", 1, [{ teamId: "2", rank: 1 }], "2024"),
      storeRankingsForWeek("lg-a", 2, [{ teamId: "1", rank: 2 }], "2024"),
      storeRankingsForWeek("lg-c", 3, [{ teamId: "3", rank: 1 }], "2023"),
    ]);

    const a = await getStoredPreviousRankings("lg-a", 3, "2024");
    const b = await getStoredPreviousRankings("lg-b", 2, "2024");
    const c = await getStoredPreviousRankings("lg-c", 4, "2023");
    expect(a).toEqual([{ teamId: "1", rank: 2 }]);
    expect(b).toEqual([{ teamId: "2", rank: 1 }]);
    expect(c).toEqual([{ teamId: "3", rank: 1 }]);

    const raw = JSON.parse(await fs.readFile(tmpFile, "utf8")) as {
      snapshots: Record<string, unknown>;
    };
    expect(Object.keys(raw.snapshots).sort()).toEqual([
      "lg-a|2024|1",
      "lg-a|2024|2",
      "lg-b|2024|1",
      "lg-c|2023|3",
    ]);
  });
});
