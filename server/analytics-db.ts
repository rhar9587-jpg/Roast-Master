// @ts-ignore - pg module types not available, but runtime works fine
import pg from "pg";

const { Pool } = pg;

interface InMemoryState {
  counts: Record<string, number>;
  events: Array<{
    type: string;
    route: string;
    method: string;
    timestamp: number;
    meta: Record<string, any>;
  }>;
  firstStartedAt: number;
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
        meta JSONB NOT NULL DEFAULT '{}'
      );
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

export async function recordEvent(
  type: string,
  route: string,
  method: string,
  timestamp: number = Date.now(),
  meta: Record<string, any> = {}
): Promise<void> {
  await initDb();
  
  if (dbAvailable && pool) {
    try {
      await pool.query(`
        INSERT INTO analytics_counters (type, count) VALUES ($1, 1)
        ON CONFLICT(type) DO UPDATE SET count = analytics_counters.count + 1
      `, [type]);
      
      await pool.query(`
        INSERT INTO analytics_events (type, route, method, timestamp, meta) 
        VALUES ($1, $2, $3, $4, $5)
      `, [type, route, method, timestamp, JSON.stringify(meta)]);
      
      const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM analytics_events");
      const count = parseInt(rows[0].cnt, 10);
      if (count > 1000) {
        await pool.query(`
          DELETE FROM analytics_events WHERE id IN (
            SELECT id FROM analytics_events ORDER BY timestamp ASC LIMIT $1
          )
        `, [count - 500]);
      }
    } catch (err) {
      console.error("[analytics-db] Error recording event:", err);
    }
  } else {
    const fallback = getInMemoryFallback();
    fallback.counts[type] = (fallback.counts[type] || 0) + 1;
    fallback.events.push({ type, route, method, timestamp, meta });
    if (fallback.events.length > 100) {
      fallback.events = fallback.events.slice(-50);
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
