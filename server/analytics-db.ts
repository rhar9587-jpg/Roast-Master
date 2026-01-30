// @ts-ignore - pg module types not available, but runtime works fine
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

interface AnalyticsEvent {
  type: string;
  route: string;
  method: string;
  timestamp: number;
  meta: Record<string, any>;
  league_id?: string;
  user_agent?: string;
  ip_hash?: string;
}

interface InMemoryState {
  counts: Record<string, number>;
  events: AnalyticsEvent[];
  firstStartedAt: number;
}

// Hash IP for privacy (no raw IPs stored)
export function hashIp(ip: string): string {
  if (!ip) return "";
  return crypto.createHash("sha256").update(ip + "fantasy-roast-salt").digest("hex").slice(0, 16);
}

let pool: pg.Pool | null = null;
let dbInitialized = false;
let dbAvailable = false;
let inMemoryFallback: InMemoryState | null = null;

async function initDb(): Promise<boolean> {
  if (dbInitialized) return dbAvailable;
  dbInitialized = true;
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[analytics-db] No DATABASE_URL, using in-memory fallback");
    return false;
  }
  
  try {
    pool = new Pool({ connectionString: dbUrl, max: 3 });
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_counters (
        type TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        route TEXT NOT NULL,
        method TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        meta JSONB NOT NULL DEFAULT '{}',
        league_id TEXT,
        user_agent TEXT,
        ip_hash TEXT
      );
    `);
    
    // Add columns if they don't exist (for existing DBs)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS league_id TEXT;
        ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS ip_hash TEXT;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp 
      ON analytics_events(timestamp DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_league 
      ON analytics_events(league_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type 
      ON analytics_events(type);
    `);
    
    const { rows } = await pool.query(
      "SELECT value FROM analytics_metadata WHERE key = 'firstStartedAt'"
    );
    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO analytics_metadata (key, value) VALUES ('firstStartedAt', $1)",
        [String(Date.now())]
      );
    }
    
    dbAvailable = true;
    console.log("[analytics-db] PostgreSQL initialized successfully");
    return true;
  } catch (err) {
    console.error("[analytics-db] Failed to initialize PostgreSQL, using in-memory fallback:", err);
    pool = null;
    return false;
  }
}

function getInMemoryFallback(): InMemoryState {
  if (!inMemoryFallback) {
    inMemoryFallback = {
      counts: {},
      events: [],
      firstStartedAt: Date.now(),
    };
  }
  return inMemoryFallback;
}

export async function ensureDb(): Promise<void> {
  await initDb();
}

export interface RecordEventOptions {
  league_id?: string;
  user_agent?: string;
  ip_hash?: string;
}

export async function recordEvent(
  type: string,
  route: string,
  method: string,
  timestamp: number = Date.now(),
  meta: Record<string, any> = {},
  options: RecordEventOptions = {}
): Promise<void> {
  await initDb();
  
  // Extract league_id from meta if not provided directly
  const league_id = options.league_id || meta.league_id || null;
  const user_agent = options.user_agent || null;
  const ip_hash = options.ip_hash || null;
  
  if (dbAvailable && pool) {
    try {
      await pool.query(`
        INSERT INTO analytics_counters (type, count) VALUES ($1, 1)
        ON CONFLICT(type) DO UPDATE SET count = analytics_counters.count + 1
      `, [type]);
      
      await pool.query(`
        INSERT INTO analytics_events (type, route, method, timestamp, meta, league_id, user_agent, ip_hash) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [type, route, method, timestamp, JSON.stringify(meta), league_id, user_agent, ip_hash]);
      
      const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM analytics_events");
      const count = parseInt(rows[0].cnt, 10);
      if (count > 10000) {
        // Keep more events for better analytics (was 500, now 5000)
        await pool.query(`
          DELETE FROM analytics_events WHERE id IN (
            SELECT id FROM analytics_events ORDER BY timestamp ASC LIMIT $1
          )
        `, [count - 5000]);
      }
    } catch (err) {
      console.error("[analytics-db] Error recording event:", err);
    }
  } else {
    const fallback = getInMemoryFallback();
    fallback.counts[type] = (fallback.counts[type] || 0) + 1;
    fallback.events.push({ type, route, method, timestamp, meta, league_id: league_id || undefined, user_agent: user_agent || undefined, ip_hash: ip_hash || undefined });
    if (fallback.events.length > 500) {
      fallback.events = fallback.events.slice(-250);
    }
  }
}

export async function getTotals(): Promise<Record<string, number>> {
  await initDb();
  
  if (dbAvailable && pool) {
    try {
      const { rows } = await pool.query("SELECT type, count FROM analytics_counters");
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.type] = parseInt(row.count, 10);
      }
      return result;
    } catch (err) {
      console.error("[analytics-db] Error reading totals:", err);
      return {};
    }
  } else {
    return { ...getInMemoryFallback().counts };
  }
}

export async function getRecentEvents(limit: number = 50): Promise<Array<{
  type: string;
  route: string;
  method: string;
  time: string;
  meta: Record<string, any>;
}>> {
  await initDb();
  
  if (dbAvailable && pool) {
    try {
      const { rows } = await pool.query(`
        SELECT type, route, method, timestamp, meta FROM analytics_events 
        ORDER BY timestamp DESC LIMIT $1
      `, [limit]);
      
      return rows.map((row: { type: string; route: string; method: string; timestamp: string; meta: string | Record<string, any> }) => ({
        type: row.type,
        route: row.route,
        method: row.method,
        time: new Date(parseInt(row.timestamp, 10)).toISOString(),
        meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      }));
    } catch (err) {
      console.error("[analytics-db] Error reading events:", err);
      return [];
    }
  } else {
    const fallback = getInMemoryFallback();
    return fallback.events.slice(-limit).reverse().map(e => ({
      type: e.type,
      route: e.route,
      method: e.method,
      time: new Date(e.timestamp).toISOString(),
      meta: e.meta,
    }));
  }
}

export async function getFirstStartedAt(): Promise<number> {
  await initDb();
  
  if (dbAvailable && pool) {
    try {
      const { rows } = await pool.query(
        "SELECT value FROM analytics_metadata WHERE key = 'firstStartedAt'"
      );
      return rows.length > 0 ? parseInt(rows[0].value, 10) : Date.now();
    } catch (err) {
      console.error("[analytics-db] Error reading firstStartedAt:", err);
      return Date.now();
    }
  } else {
    return getInMemoryFallback().firstStartedAt;
  }
}

export async function isUsingDatabase(): Promise<boolean> {
  await initDb();
  return dbAvailable;
}

// --- Summary/Funnel Analytics ---

export interface AnalyticsSummary {
  events_24h: number;
  events_7d: number;
  unique_leagues_24h: number;
  unique_leagues_7d: number;
  unique_leagues_all: number;
  funnel: {
    unlock_clicked: number;
    checkout_session_created: number;
    purchase_success: number;
    purchase_cancel: number;
  };
  funnel_7d: {
    unlock_clicked: number;
    checkout_session_created: number;
    purchase_success: number;
    purchase_cancel: number;
  };
  top_events_24h: Array<{ type: string; count: number }>;
  storage_type: "postgresql" | "in-memory";
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  await initDb();
  
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ts24h = now - ms24h;
  const ts7d = now - ms7d;
  
  if (dbAvailable && pool) {
    try {
      // Events count 24h/7d
      const [res24h, res7d] = await Promise.all([
        pool.query("SELECT COUNT(*) as cnt FROM analytics_events WHERE timestamp > $1", [ts24h]),
        pool.query("SELECT COUNT(*) as cnt FROM analytics_events WHERE timestamp > $1", [ts7d]),
      ]);
      
      // Unique leagues
      const [leagues24h, leagues7d, leaguesAll] = await Promise.all([
        pool.query("SELECT COUNT(DISTINCT league_id) as cnt FROM analytics_events WHERE timestamp > $1 AND league_id IS NOT NULL", [ts24h]),
        pool.query("SELECT COUNT(DISTINCT league_id) as cnt FROM analytics_events WHERE timestamp > $1 AND league_id IS NOT NULL", [ts7d]),
        pool.query("SELECT COUNT(DISTINCT league_id) as cnt FROM analytics_events WHERE league_id IS NOT NULL"),
      ]);
      
      // Funnel counts (all time from counters)
      const funnelTypes = ["unlock_clicked", "checkout_session_created", "purchase_success", "purchase_cancel"];
      const funnelRes = await pool.query(
        "SELECT type, count FROM analytics_counters WHERE type = ANY($1)",
        [funnelTypes]
      );
      const funnelMap: Record<string, number> = {};
      for (const row of funnelRes.rows) {
        funnelMap[row.type] = parseInt(row.count, 10);
      }
      
      // Funnel counts 7d
      const funnel7dRes = await pool.query(
        "SELECT type, COUNT(*) as cnt FROM analytics_events WHERE type = ANY($1) AND timestamp > $2 GROUP BY type",
        [funnelTypes, ts7d]
      );
      const funnel7dMap: Record<string, number> = {};
      for (const row of funnel7dRes.rows) {
        funnel7dMap[row.type] = parseInt(row.cnt, 10);
      }
      
      // Top events 24h
      const topRes = await pool.query(
        "SELECT type, COUNT(*) as cnt FROM analytics_events WHERE timestamp > $1 GROUP BY type ORDER BY cnt DESC LIMIT 10",
        [ts24h]
      );
      
      return {
        events_24h: parseInt(res24h.rows[0].cnt, 10),
        events_7d: parseInt(res7d.rows[0].cnt, 10),
        unique_leagues_24h: parseInt(leagues24h.rows[0].cnt, 10),
        unique_leagues_7d: parseInt(leagues7d.rows[0].cnt, 10),
        unique_leagues_all: parseInt(leaguesAll.rows[0].cnt, 10),
        funnel: {
          unlock_clicked: funnelMap["unlock_clicked"] || 0,
          checkout_session_created: funnelMap["checkout_session_created"] || 0,
          purchase_success: funnelMap["purchase_success"] || 0,
          purchase_cancel: funnelMap["purchase_cancel"] || 0,
        },
        funnel_7d: {
          unlock_clicked: funnel7dMap["unlock_clicked"] || 0,
          checkout_session_created: funnel7dMap["checkout_session_created"] || 0,
          purchase_success: funnel7dMap["purchase_success"] || 0,
          purchase_cancel: funnel7dMap["purchase_cancel"] || 0,
        },
        top_events_24h: topRes.rows.map((r: { type: string; cnt: string }) => ({ type: r.type, count: parseInt(r.cnt, 10) })),
        storage_type: "postgresql",
      };
    } catch (err) {
      console.error("[analytics-db] Error getting summary:", err);
      return getInMemorySummary(ts24h, ts7d);
    }
  } else {
    return getInMemorySummary(ts24h, ts7d);
  }
}

function getInMemorySummary(ts24h: number, ts7d: number): AnalyticsSummary {
  const fallback = getInMemoryFallback();
  const events24h = fallback.events.filter(e => e.timestamp > ts24h);
  const events7d = fallback.events.filter(e => e.timestamp > ts7d);
  
  const uniqueLeagues24h = new Set(events24h.filter(e => e.league_id).map(e => e.league_id));
  const uniqueLeagues7d = new Set(events7d.filter(e => e.league_id).map(e => e.league_id));
  const uniqueLeaguesAll = new Set(fallback.events.filter(e => e.league_id).map(e => e.league_id));
  
  const funnelTypes = ["unlock_clicked", "checkout_session_created", "purchase_success", "purchase_cancel"];
  const funnel7d: Record<string, number> = {};
  for (const t of funnelTypes) {
    funnel7d[t] = events7d.filter(e => e.type === t).length;
  }
  
  // Top events 24h
  const typeCounts: Record<string, number> = {};
  for (const e of events24h) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }
  const topEvents = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));
  
  return {
    events_24h: events24h.length,
    events_7d: events7d.length,
    unique_leagues_24h: uniqueLeagues24h.size,
    unique_leagues_7d: uniqueLeagues7d.size,
    unique_leagues_all: uniqueLeaguesAll.size,
    funnel: {
      unlock_clicked: fallback.counts["unlock_clicked"] || 0,
      checkout_session_created: fallback.counts["checkout_session_created"] || 0,
      purchase_success: fallback.counts["purchase_success"] || 0,
      purchase_cancel: fallback.counts["purchase_cancel"] || 0,
    },
    funnel_7d: {
      unlock_clicked: funnel7d["unlock_clicked"] || 0,
      checkout_session_created: funnel7d["checkout_session_created"] || 0,
      purchase_success: funnel7d["purchase_success"] || 0,
      purchase_cancel: funnel7d["purchase_cancel"] || 0,
    },
    top_events_24h: topEvents,
    storage_type: "in-memory",
  };
}
