/**
 * Weekly power-ranking history — durable across restarts.
 *
 * Persistence stack (matches entitlementsStore / analytics-db):
 * 1. PostgreSQL when DATABASE_URL is set (CREATE TABLE IF NOT EXISTS)
 * 2. File store under .data/weekly-rankings.json otherwise
 *
 * In-memory is never the authority — only an optional read-through cache
 * that is discarded when the durable backend is reset or fails.
 *
 * Failure policy:
 * - Read failure → [] (trends stay flat; never invent movement)
 * - Write failure → log and continue (current rankings still returned)
 */

import { promises as fs } from "fs";
import path from "path";
// @ts-ignore - pg typings may be unavailable in some environments
import pg from "pg";

const { Pool } = pg;

export type StoredRanking = {
  teamId: string;
  rank: number;
  powerScore?: number;
};

export type RankingSnapshotKey = {
  leagueId: string;
  season: string;
  week: number;
};

/** Pure: pick previous week number when we only have exact week-1 (legacy callers). */
export function previousWeekNumber(forWeek: number): number {
  return forWeek - 1;
}

export type RankingHistoryBackend = {
  /** Latest snapshot for this league+season with week strictly less than `beforeWeek`. */
  getLatestBefore(
    leagueId: string,
    season: string,
    beforeWeek: number,
  ): Promise<StoredRanking[]>;
  /** Idempotent upsert of all team rows for a league+season+week. */
  upsertWeek(
    leagueId: string,
    season: string,
    week: number,
    rankings: StoredRanking[],
  ): Promise<void>;
  /** Test / restart simulation: clear durable + any cache. */
  clearAll?(): Promise<void>;
};

type FileStoreShape = {
  /** `${leagueId}|${season}|${week}` → rows keyed by teamId */
  snapshots: Record<string, Record<string, StoredRanking>>;
};

const FILE_PATH = path.resolve(process.cwd(), ".data", "weekly-rankings.json");

function snapshotKey(leagueId: string, season: string, week: number): string {
  return `${leagueId}|${season}|${week}`;
}

function normalizeSeason(season: string | null | undefined): string {
  const s = (season ?? "").trim();
  return s || "unknown";
}

/** In-memory backend for unit tests (not used as production authority). */
export function createMemoryRankingBackend(): RankingHistoryBackend & {
  /** Expose raw map for restart-simulation assertions. */
  _dump(): FileStoreShape;
  _load(data: FileStoreShape): void;
} {
  let data: FileStoreShape = { snapshots: {} };
  return {
    _dump: () => structuredClone(data),
    _load: (next) => {
      data = structuredClone(next);
    },
    async getLatestBefore(leagueId, season, beforeWeek) {
      const seasonN = normalizeSeason(season);
      let bestWeek = -1;
      let best: Record<string, StoredRanking> | null = null;
      for (const [k, rows] of Object.entries(data.snapshots)) {
        const [lg, sea, wStr] = k.split("|");
        const w = Number(wStr);
        if (lg !== leagueId || sea !== seasonN) continue;
        if (!Number.isFinite(w) || w >= beforeWeek || w < 1) continue;
        if (w > bestWeek) {
          bestWeek = w;
          best = rows;
        }
      }
      if (!best) return [];
      return Object.values(best).map((r) => ({
        teamId: r.teamId,
        rank: r.rank,
        ...(r.powerScore != null ? { powerScore: r.powerScore } : {}),
      }));
    },
    async upsertWeek(leagueId, season, week, rankings) {
      if (week < 1) return;
      const seasonN = normalizeSeason(season);
      const k = snapshotKey(leagueId, seasonN, week);
      const byTeam: Record<string, StoredRanking> = {};
      for (const r of rankings) {
        if (!r.teamId) continue;
        byTeam[r.teamId] = {
          teamId: r.teamId,
          rank: r.rank,
          ...(r.powerScore != null ? { powerScore: r.powerScore } : {}),
        };
      }
      data.snapshots[k] = byTeam;
    },
    async clearAll() {
      data = { snapshots: {} };
    },
  };
}

function createFileRankingBackend(): RankingHistoryBackend {
  async function readFile(): Promise<FileStoreShape> {
    try {
      const raw = await fs.readFile(FILE_PATH, "utf8");
      const parsed = JSON.parse(raw) as FileStoreShape;
      if (!parsed || typeof parsed !== "object" || !parsed.snapshots) {
        return { snapshots: {} };
      }
      return parsed;
    } catch {
      return { snapshots: {} };
    }
  }

  async function writeFile(data: FileStoreShape): Promise<void> {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  return {
    async getLatestBefore(leagueId, season, beforeWeek) {
      const seasonN = normalizeSeason(season);
      const data = await readFile();
      let bestWeek = -1;
      let best: Record<string, StoredRanking> | null = null;
      for (const [k, rows] of Object.entries(data.snapshots)) {
        const [lg, sea, wStr] = k.split("|");
        const w = Number(wStr);
        if (lg !== leagueId || sea !== seasonN) continue;
        if (!Number.isFinite(w) || w >= beforeWeek || w < 1) continue;
        if (w > bestWeek) {
          bestWeek = w;
          best = rows;
        }
      }
      if (!best) return [];
      return Object.values(best).map((r) => ({
        teamId: r.teamId,
        rank: r.rank,
        ...(r.powerScore != null ? { powerScore: r.powerScore } : {}),
      }));
    },
    async upsertWeek(leagueId, season, week, rankings) {
      if (week < 1) return;
      const seasonN = normalizeSeason(season);
      const data = await readFile();
      const k = snapshotKey(leagueId, seasonN, week);
      const byTeam: Record<string, StoredRanking> = {};
      for (const r of rankings) {
        if (!r.teamId) continue;
        byTeam[r.teamId] = {
          teamId: r.teamId,
          rank: r.rank,
          ...(r.powerScore != null ? { powerScore: r.powerScore } : {}),
        };
      }
      data.snapshots[k] = byTeam;
      await writeFile(data);
    },
    async clearAll() {
      try {
        await fs.unlink(FILE_PATH);
      } catch {
        // ignore missing file
      }
    },
  };
}

function createPostgresRankingBackend(pool: pg.Pool): RankingHistoryBackend {
  return {
    async getLatestBefore(leagueId, season, beforeWeek) {
      const seasonN = normalizeSeason(season);
      const { rows: weekRows } = await pool.query(
        `SELECT week FROM weekly_power_rankings
         WHERE league_id = $1 AND season = $2 AND week < $3
         ORDER BY week DESC
         LIMIT 1`,
        [leagueId, seasonN, beforeWeek],
      );
      if (!weekRows.length) return [];
      const week = Number(weekRows[0].week);
      const { rows } = await pool.query(
        `SELECT team_id, rank, power_score
         FROM weekly_power_rankings
         WHERE league_id = $1 AND season = $2 AND week = $3
         ORDER BY rank ASC`,
        [leagueId, seasonN, week],
      );
      return rows.map((r: { team_id: string; rank: number; power_score: number | null }) => ({
        teamId: String(r.team_id),
        rank: Number(r.rank),
        ...(r.power_score != null && Number.isFinite(Number(r.power_score))
          ? { powerScore: Number(r.power_score) }
          : {}),
      }));
    },
    async upsertWeek(leagueId, season, week, rankings) {
      if (week < 1) return;
      const seasonN = normalizeSeason(season);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Replace snapshot for this league+season+week (idempotent).
        await client.query(
          `DELETE FROM weekly_power_rankings
           WHERE league_id = $1 AND season = $2 AND week = $3`,
          [leagueId, seasonN, week],
        );
        for (const r of rankings) {
          if (!r.teamId) continue;
          await client.query(
            `INSERT INTO weekly_power_rankings
               (league_id, season, week, team_id, rank, power_score, calculated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (league_id, season, week, team_id)
             DO UPDATE SET
               rank = EXCLUDED.rank,
               power_score = EXCLUDED.power_score,
               calculated_at = NOW()`,
            [
              leagueId,
              seasonN,
              week,
              r.teamId,
              r.rank,
              r.powerScore ?? null,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async clearAll() {
      await pool.query("DELETE FROM weekly_power_rankings");
    },
  };
}

let pool: pg.Pool | null = null;
let dbInitDone = false;
let dbAvailable = false;
let activeBackend: RankingHistoryBackend | null = null;
/** Injected override (tests). */
let injectedBackend: RankingHistoryBackend | null = null;

async function ensurePostgresSchema(p: pg.Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS weekly_power_rankings (
      league_id TEXT NOT NULL,
      season TEXT NOT NULL,
      week INTEGER NOT NULL,
      team_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      power_score DOUBLE PRECISION,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (league_id, season, week, team_id)
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_weekly_power_rankings_lookup
    ON weekly_power_rankings (league_id, season, week);
  `);
}

async function initBackend(): Promise<RankingHistoryBackend> {
  if (injectedBackend) return injectedBackend;
  if (activeBackend) return activeBackend;

  if (!dbInitDone) {
    dbInitDone = true;
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        pool = new Pool({ connectionString: dbUrl, max: 3 });
        await ensurePostgresSchema(pool);
        dbAvailable = true;
        console.log("[weekly-rankings] PostgreSQL backend ready");
      } catch (err) {
        console.error("[weekly-rankings] DB init failed, using file backend:", err);
        pool = null;
        dbAvailable = false;
      }
    }
  }

  activeBackend = dbAvailable && pool ? createPostgresRankingBackend(pool) : createFileRankingBackend();
  return activeBackend;
}

/** Test-only: inject a backend (e.g. memory) and skip production init. */
export function __setRankingHistoryBackendForTests(backend: RankingHistoryBackend | null): void {
  injectedBackend = backend;
  activeBackend = null;
}

/** Test-only: reset module init flags (simulates process restart with fresh module state). */
export function __resetRankingHistoryModuleForTests(): void {
  injectedBackend = null;
  activeBackend = null;
  dbInitDone = false;
  dbAvailable = false;
  if (pool) {
    try {
      pool.end();
    } catch {
      // ignore
    }
  }
  pool = null;
}

/**
 * Previous rankings for computing trends when generating Week `forWeek`.
 * Uses the latest durable snapshot with week < forWeek in the same league+season.
 * On any read failure: returns [] (conservative flat trends).
 */
export async function getStoredPreviousRankings(
  leagueId: string,
  forWeek: number,
  season: string = "unknown",
): Promise<StoredRanking[]> {
  const id = leagueId.trim();
  if (!id || forWeek < 2) return [];
  try {
    const backend = await initBackend();
    return await backend.getLatestBefore(id, normalizeSeason(season), forWeek);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "weekly_rankings_read_failed",
        leagueId: id,
        season: normalizeSeason(season),
        forWeek,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

/**
 * Persist rankings for a week (idempotent upsert).
 * Write failures are logged and swallowed so callers stay usable.
 */
export async function storeRankingsForWeek(
  leagueId: string,
  week: number,
  rankings: Array<{ teamId: string; rank: number; powerScore?: number }>,
  season: string = "unknown",
): Promise<void> {
  const id = leagueId.trim();
  if (!id || week < 1) return;
  try {
    const backend = await initBackend();
    await backend.upsertWeek(
      id,
      normalizeSeason(season),
      week,
      rankings.map((r) => ({
        teamId: r.teamId,
        rank: r.rank,
        ...(r.powerScore != null ? { powerScore: r.powerScore } : {}),
      })),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "weekly_rankings_write_failed",
        leagueId: id,
        season: normalizeSeason(season),
        week,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export { normalizeSeason as normalizeRankingSeason };
