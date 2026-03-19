// @ts-ignore - pg typings may be unavailable in some environments
import pg from "pg";
import { promises as fs } from "fs";
import path from "path";

const { Pool } = pg;

type UnlockFileStore = { unlockedLeagueIds: string[] };
type FreeSendFileStore = { usedByLeague: Record<string, { usedAt: string; usedBy?: string }> };

const UNLOCK_STORE_PATH = path.resolve(process.cwd(), ".data", "league-unlocks.json");
const FREE_SEND_STORE_PATH = path.resolve(process.cwd(), ".data", "free-send-usage.json");

let pool: pg.Pool | null = null;
let dbInitDone = false;
let dbAvailable = false;

async function initDb(): Promise<boolean> {
  if (dbInitDone) return dbAvailable;
  dbInitDone = true;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  try {
    pool = new Pool({ connectionString: dbUrl, max: 3 });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS league_unlocks (
        league_id TEXT PRIMARY KEY,
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_email_free_send (
        league_id TEXT PRIMARY KEY,
        used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        used_by TEXT
      );
    `);
    dbAvailable = true;
    return true;
  } catch (err) {
    console.error("[entitlements-store] DB init failed, using file fallback:", err);
    pool = null;
    dbAvailable = false;
    return false;
  }
}

async function readUnlockFile(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(UNLOCK_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UnlockFileStore;
    return new Set((parsed.unlockedLeagueIds || []).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function writeUnlockFile(values: Set<string>): Promise<void> {
  await fs.mkdir(path.dirname(UNLOCK_STORE_PATH), { recursive: true });
  const payload: UnlockFileStore = { unlockedLeagueIds: Array.from(values).sort() };
  await fs.writeFile(UNLOCK_STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function readFreeSendFile(): Promise<FreeSendFileStore> {
  try {
    const raw = await fs.readFile(FREE_SEND_STORE_PATH, "utf8");
    return JSON.parse(raw) as FreeSendFileStore;
  } catch {
    return { usedByLeague: {} };
  }
}

async function writeFreeSendFile(data: FreeSendFileStore): Promise<void> {
  await fs.mkdir(path.dirname(FREE_SEND_STORE_PATH), { recursive: true });
  await fs.writeFile(FREE_SEND_STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function isLeagueUnlocked(leagueId: string): Promise<boolean> {
  const id = leagueId.trim();
  if (!id) return false;
  if (await initDb()) {
    try {
      const res = await pool!.query("SELECT 1 FROM league_unlocks WHERE league_id = $1 LIMIT 1", [id]);
      return res.rows.length > 0;
    } catch (err) {
      console.error("[entitlements-store] isLeagueUnlocked DB error:", err);
    }
  }
  const local = await readUnlockFile();
  return local.has(id);
}

export async function markLeagueUnlocked(leagueId: string, source?: string): Promise<void> {
  const id = leagueId.trim();
  if (!id) return;
  if (await initDb()) {
    try {
      await pool!.query(
        "INSERT INTO league_unlocks (league_id, source) VALUES ($1, $2) ON CONFLICT (league_id) DO NOTHING",
        [id, source || null],
      );
      return;
    } catch (err) {
      console.error("[entitlements-store] markLeagueUnlocked DB error:", err);
    }
  }
  const local = await readUnlockFile();
  if (local.has(id)) return;
  local.add(id);
  await writeUnlockFile(local);
}

export async function hasUsedFreeSend(leagueId: string): Promise<boolean> {
  const id = leagueId.trim();
  if (!id) return false;
  if (await initDb()) {
    try {
      const res = await pool!.query("SELECT 1 FROM weekly_email_free_send WHERE league_id = $1 LIMIT 1", [id]);
      return res.rows.length > 0;
    } catch (err) {
      console.error("[entitlements-store] hasUsedFreeSend DB error:", err);
    }
  }
  const local = await readFreeSendFile();
  return Boolean(local.usedByLeague[id]);
}

export async function markFreeSendUsed(leagueId: string, usedBy?: string): Promise<void> {
  const id = leagueId.trim();
  if (!id) return;
  if (await initDb()) {
    try {
      await pool!.query(
        "INSERT INTO weekly_email_free_send (league_id, used_by) VALUES ($1, $2) ON CONFLICT (league_id) DO NOTHING",
        [id, usedBy || null],
      );
      return;
    } catch (err) {
      console.error("[entitlements-store] markFreeSendUsed DB error:", err);
    }
  }
  const local = await readFreeSendFile();
  if (local.usedByLeague[id]) return;
  local.usedByLeague[id] = { usedAt: new Date().toISOString(), ...(usedBy ? { usedBy } : {}) };
  await writeFreeSendFile(local);
}

export async function getFreeSendStatus(leagueId: string): Promise<{ used: boolean; usedAt?: string }> {
  const id = leagueId.trim();
  if (!id) return { used: false };
  if (await initDb()) {
    try {
      const res = await pool!.query("SELECT used_at FROM weekly_email_free_send WHERE league_id = $1 LIMIT 1", [id]);
      if (res.rows.length === 0) return { used: false };
      return { used: true, usedAt: new Date(res.rows[0].used_at).toISOString() };
    } catch (err) {
      console.error("[entitlements-store] getFreeSendStatus DB error:", err);
    }
  }
  const local = await readFreeSendFile();
  const row = local.usedByLeague[id];
  return row ? { used: true, usedAt: row.usedAt } : { used: false };
}
