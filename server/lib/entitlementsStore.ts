// @ts-ignore - pg typings may be unavailable in some environments
import pg from "pg";
import { promises as fs } from "fs";
import path from "path";

const { Pool } = pg;

type UnlockEntitlement = {
  leagueId: string;
  email: string;
  sessionId?: string | null;
  customerId?: string | null;
  unlockedAt: string;
  source?: string | null;
};

type UnlockFileStore = {
  unlockedLeagueIds: string[];
  entitlements?: UnlockEntitlement[];
};

type FreeSendFileStore = { usedByLeague: Record<string, { usedAt: string; usedBy?: string }> };

const UNLOCK_STORE_PATH = path.resolve(process.cwd(), ".data", "league-unlocks.json");
const FREE_SEND_STORE_PATH = path.resolve(process.cwd(), ".data", "free-send-usage.json");

let pool: pg.Pool | null = null;
let dbInitDone = false;
let dbAvailable = false;

export function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

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
      CREATE TABLE IF NOT EXISTS unlock_entitlements (
        id BIGSERIAL PRIMARY KEY,
        league_id TEXT NOT NULL,
        email TEXT NOT NULL,
        stripe_session_id TEXT,
        stripe_customer_id TEXT,
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source TEXT,
        UNIQUE (league_id, email)
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unlock_entitlements_session_uidx
      ON unlock_entitlements (stripe_session_id)
      WHERE stripe_session_id IS NOT NULL;
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

async function readUnlockFile(): Promise<UnlockFileStore> {
  try {
    const raw = await fs.readFile(UNLOCK_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UnlockFileStore;
    return {
      unlockedLeagueIds: Array.isArray(parsed.unlockedLeagueIds)
        ? parsed.unlockedLeagueIds.filter(Boolean)
        : [],
      entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
    };
  } catch {
    return { unlockedLeagueIds: [], entitlements: [] };
  }
}

async function writeUnlockFile(store: UnlockFileStore): Promise<void> {
  await fs.mkdir(path.dirname(UNLOCK_STORE_PATH), { recursive: true });
  const payload: UnlockFileStore = {
    unlockedLeagueIds: Array.from(new Set(store.unlockedLeagueIds.filter(Boolean))).sort(),
    entitlements: store.entitlements || [],
  };
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
  return local.unlockedLeagueIds.includes(id);
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
  if (local.unlockedLeagueIds.includes(id)) return;
  local.unlockedLeagueIds.push(id);
  await writeUnlockFile(local);
}

/**
 * Persist a paid unlock keyed by league + purchase email (+ Stripe session/customer when present).
 * Also marks the league unlocked for server-side gates.
 */
export async function recordUnlockEntitlement(input: {
  leagueId: string;
  email?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
  source?: string;
}): Promise<void> {
  const leagueId = String(input.leagueId || "").trim();
  if (!leagueId) return;

  const email = normalizeEmail(input.email || "");
  const sessionId = input.sessionId ? String(input.sessionId).trim() : null;
  const customerId = input.customerId ? String(input.customerId).trim() : null;
  const source = input.source || "stripe";

  await markLeagueUnlocked(leagueId, source);

  if (!email && !sessionId) return;

  if (await initDb()) {
    try {
      if (email) {
        await pool!.query(
          `INSERT INTO unlock_entitlements
             (league_id, email, stripe_session_id, stripe_customer_id, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (league_id, email) DO UPDATE SET
             stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, unlock_entitlements.stripe_session_id),
             stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, unlock_entitlements.stripe_customer_id),
             source = COALESCE(EXCLUDED.source, unlock_entitlements.source)`,
          [leagueId, email, sessionId, customerId, source],
        );
      } else if (sessionId) {
        await pool!.query(
          `INSERT INTO unlock_entitlements
             (league_id, email, stripe_session_id, stripe_customer_id, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [leagueId, `session:${sessionId}`, sessionId, customerId, source],
        );
      }
      return;
    } catch (err) {
      console.error("[entitlements-store] recordUnlockEntitlement DB error:", err);
    }
  }

  const local = await readUnlockFile();
  const entitlements = local.entitlements || [];
  const now = new Date().toISOString();
  if (email) {
    const idx = entitlements.findIndex(
      (e) => e.leagueId === leagueId && normalizeEmail(e.email) === email,
    );
    const row: UnlockEntitlement = {
      leagueId,
      email,
      sessionId,
      customerId,
      unlockedAt: now,
      source,
    };
    if (idx >= 0) {
      entitlements[idx] = {
        ...entitlements[idx],
        ...row,
        sessionId: sessionId || entitlements[idx].sessionId,
        customerId: customerId || entitlements[idx].customerId,
      };
    } else {
      entitlements.push(row);
    }
  } else if (sessionId && !entitlements.some((e) => e.sessionId === sessionId)) {
    entitlements.push({
      leagueId,
      email: `session:${sessionId}`,
      sessionId,
      customerId,
      unlockedAt: now,
      source,
    });
  }
  if (!local.unlockedLeagueIds.includes(leagueId)) {
    local.unlockedLeagueIds.push(leagueId);
  }
  local.entitlements = entitlements;
  await writeUnlockFile(local);
}

export async function findUnlocksByEmail(
  emailRaw: string,
  leagueId?: string | null,
): Promise<{ leagueIds: string[]; customerId: string | null }> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { leagueIds: [], customerId: null };
  const leagueFilter = leagueId?.trim() || null;

  if (await initDb()) {
    try {
      const res = leagueFilter
        ? await pool!.query(
            `SELECT league_id, stripe_customer_id
             FROM unlock_entitlements
             WHERE email = $1 AND league_id = $2
             ORDER BY unlocked_at DESC`,
            [email, leagueFilter],
          )
        : await pool!.query(
            `SELECT league_id, stripe_customer_id
             FROM unlock_entitlements
             WHERE email = $1
             ORDER BY unlocked_at DESC`,
            [email],
          );
      const leagueIds = Array.from(
        new Set(res.rows.map((r: { league_id: string }) => String(r.league_id)).filter(Boolean)),
      );
      const customerId =
        res.rows.map((r: { stripe_customer_id?: string | null }) => r.stripe_customer_id).find(Boolean) ||
        null;
      return { leagueIds, customerId: customerId ? String(customerId) : null };
    } catch (err) {
      console.error("[entitlements-store] findUnlocksByEmail DB error:", err);
    }
  }

  const local = await readUnlockFile();
  const matches = (local.entitlements || []).filter(
    (e) =>
      normalizeEmail(e.email) === email &&
      (!leagueFilter || e.leagueId === leagueFilter),
  );
  const leagueIds = Array.from(new Set(matches.map((e) => e.leagueId).filter(Boolean)));
  const customerId = matches.map((e) => e.customerId).find(Boolean) || null;
  return { leagueIds, customerId: customerId ? String(customerId) : null };
}

export async function findCustomerIdByEmail(emailRaw: string): Promise<string | null> {
  const { customerId } = await findUnlocksByEmail(emailRaw);
  return customerId;
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
