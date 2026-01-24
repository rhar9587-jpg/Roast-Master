// server/fpl.ts - FPL (Fantasy Premier League) API module
import type { FplCard, FplRoastRequest, FplRoastResponse } from "@shared/schema";

// -------------------------
// Types for FPL API responses
// -------------------------
interface FplBootstrapStatic {
  elements: FplPlayer[];
  events: FplEvent[];
  teams: FplTeam[];
}

interface FplPlayer {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  selected_by_percent: string;
  event_points: number;
  team: number;
  element_type: number;
}

interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  is_current: boolean;
  is_next: boolean;
}

interface FplTeam {
  id: number;
  name: string;
  short_name: string;
}

interface FplEntryPicks {
  active_chip: string | null;
  automatic_subs: any[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    event_transfers: number;
    event_transfers_cost: number;
  };
  picks: FplPick[];
}

interface FplPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface FplEntry {
  id: number;
  player_first_name: string;
  player_last_name: string;
  name: string;
}

interface FplEntryHistory {
  current: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    event_transfers: number;
    event_transfers_cost: number;
  }[];
  past: any[];
  chips: any[];
}

interface FplElementSummary {
  fixtures: any[];
  history: {
    element: number;
    round: number;
    total_points: number;
  }[];
  history_past: any[];
}

interface FplEventLive {
  elements: {
    id: number;
    stats: {
      total_points: number;
    };
  }[];
}

// -------------------------
// In-memory cache with TTL
// -------------------------
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// -------------------------
// FPL API fetch helpers
// -------------------------
const FPL_BASE = "https://fantasy.premierleague.com/api";

async function fplFetch<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FantasyRoast/1.0",
        // Avoid intermediary caching when possible
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error("NOT_FOUND");
      const text = await res.text().catch(() => "");
      throw new Error(`FPL API ${res.status}: ${text || url}`);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`FPL API timeout after ${timeoutMs}ms: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function getBootstrapStatic(): Promise<FplBootstrapStatic> {
  const cacheKey = "fpl:bootstrap";
  const cached = getCached<FplBootstrapStatic>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplBootstrapStatic>(`${FPL_BASE}/bootstrap-static/`);
  setCache(cacheKey, data, 12 * 60 * 60 * 1000); // 12 hours
  return data;
}

async function getEntryPicks(entryId: number, eventId: number): Promise<FplEntryPicks> {
  const cacheKey = `fpl:picks:${entryId}:${eventId}`;
  const cached = getCached<FplEntryPicks>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplEntryPicks>(`${FPL_BASE}/entry/${entryId}/event/${eventId}/picks/`);
  setCache(cacheKey, data, 60 * 1000); // 1 minute (more "live")
  return data;
}

async function getEntry(entryId: number): Promise<FplEntry> {
  const cacheKey = `fpl:entry:${entryId}`;
  const cached = getCached<FplEntry>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplEntry>(`${FPL_BASE}/entry/${entryId}/`);
  setCache(cacheKey, data, 30 * 60 * 1000); // 30 minutes
  return data;
}

async function getEntryHistory(entryId: number): Promise<FplEntryHistory> {
  const cacheKey = `fpl:history:${entryId}`;
  const cached = getCached<FplEntryHistory>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplEntryHistory>(`${FPL_BASE}/entry/${entryId}/history/`);
  setCache(cacheKey, data, 5 * 60 * 1000); // 5 minutes (rank/overall can lag)
  return data;
}

async function getElementSummary(playerId: number): Promise<FplElementSummary> {
  const cacheKey = `fpl:element:${playerId}`;
  const cached = getCached<FplElementSummary>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplElementSummary>(`${FPL_BASE}/element-summary/${playerId}/`);
  setCache(cacheKey, data, 10 * 60 * 1000); // 10 minutes
  return data;
}

async function getEventLive(eventId: number): Promise<FplEventLive> {
  const cacheKey = `fpl:live:${eventId}`;
  const cached = getCached<FplEventLive>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<FplEventLive>(`${FPL_BASE}/event/${eventId}/live/`);
  setCache(cacheKey, data, 60 * 1000); // 1 minute
  return data;
}

// -------------------------
// Helper: compute live GW total (matches official app much better)
// -------------------------
function computeLiveGwTotalPoints(args: {
  picks: FplPick[];
  activeChip: string | null;
  transferHitCost: number;
  live: FplEventLive;
}): number {
  const { picks, activeChip, transferHitCost, live } = args;

  const liveMap = new Map<number, number>();
  for (const el of live.elements) {
    liveMap.set(el.id, el.stats?.total_points ?? 0);
  }

  const isBenchBoost = activeChip === "bboost";

  // Include starters; include bench only if bench boost chip is active
  const included = picks.filter((p) => p.position <= 11 || (isBenchBoost && p.position > 11));

  const gross = included.reduce((sum, p) => {
    const pts = liveMap.get(p.element) ?? 0;
    const mult = p.multiplier ?? 1; // captain will be 2 (or 3 for TC) in picks data
    return sum + pts * mult;
  }, 0);

  return gross - (transferHitCost || 0);
}

// -------------------------
// Helper to get player GW points (used by other cards)
// NOTE: This is still "best effort"; for true live accuracy you’d use event/{gw}/live
// -------------------------
async function getPlayerGwPoints(playerId: number, eventId: number, bootstrap: FplBootstrapStatic): Promise<number> {
  const player = bootstrap.elements.find((p) => p.id === playerId);
  const event = bootstrap.events.find((e) => e.id === eventId);

  // First, try element-summary historical
  try {
    const summary = await getElementSummary(playerId);
    const gwHistory = summary.history.find((h) => h.round === eventId);
    if (gwHistory) return gwHistory.total_points;
  } catch {
    // fall through
  }

  // Fallback: bootstrap event_points if current GW
  if (event?.is_current && player) {
    return player.event_points;
  }

  return 0;
}

// -------------------------
// Card 0: GAMEWEEK VERDICT (Summary card)  ✅ NOW USES LIVE FEED
// -------------------------
async function buildVerdictCard(
  entryId: number,
  eventId: number,
  picks: FplPick[],
  activeChip: string | null,
  entryHistoryFromPicks: FplEntryPicks["entry_history"]
): Promise<FplCard> {
  // Rank/overall is still from entry history (can lag; that’s ok)
  const history = await getEntryHistory(entryId);
  const currentGw = history.current.find((h) => h.event === eventId);
  const prevGw = history.current.find((h) => h.event === eventId - 1);

  // ✅ Points: compute from live endpoint so your "39" shows when the app shows 39
  const live = await getEventLive(eventId);
  const totalPoints = computeLiveGwTotalPoints({
    picks,
    activeChip,
    transferHitCost: entryHistoryFromPicks.event_transfers_cost || 0,
    live,
  });

  const gwRank = entryHistoryFromPicks.rank;

  // Calculate overall rank change
  let overallRankChange: number | null = null;
  let overallRankAfter: number | null = null;

  if (currentGw) {
    overallRankAfter = currentGw.overall_rank;
    if (prevGw) {
      overallRankChange = prevGw.overall_rank - currentGw.overall_rank;
    }
  }

  const formatRankChange = (change: number | null): string => {
    if (change === null) return "";
    if (change > 0) return `+${change.toLocaleString()}`;
    if (change < 0) return `${change.toLocaleString()}`;
    return "0";
  };

  const rankChangeArrow = (change: number | null): string => {
    if (change === null) return "";
    if (change > 0) return "↑";
    if (change < 0) return "↓";
    return "→";
  };

  let subtitle = "The damage is done.";

  const taglineLines: string[] = [];
  if (overallRankChange !== null) {
    taglineLines.push(`Overall: ${rankChangeArrow(overallRankChange)} ${formatRankChange(overallRankChange)}`);
  }
  if (gwRank) {
    taglineLines.push(`GW Rank: ${gwRank.toLocaleString()}`);
  }

  const tagline = taglineLines.length > 0 ? taglineLines.join(" | ") : "Survival, not success.";

  return {
    id: "verdict",
    title: "GAMEWEEK\nVERDICT",
    subtitle,
    tagline,
    bigValue: `${totalPoints} pts`,
    footer: overallRankAfter ? `Overall rank: ${overallRankAfter.toLocaleString()}` : "Survival, not success.",
    accent: "slate",
    meta: {
      total_points: totalPoints,
      gw_rank: gwRank,
      overall_rank_after: overallRankAfter,
      overall_rank_change: overallRankChange,
      // Optional debug meta (remove later if you want)
      points_source: "event_live_computed",
    },
  };
}

// -------------------------
// Card 1: CAPTAINCY CRISIS / CAPTAINCY MASTERCLASS
// -------------------------
async function buildCaptaincyCard(picks: FplPick[], eventId: number, bootstrap: FplBootstrapStatic): Promise<FplCard> {
  const captainPick = picks.find((p) => p.is_captain);
  if (!captainPick) {
    return {
      id: "captaincy",
      title: "CAPTAINCY CRISIS",
      subtitle: "No captain found",
      bigValue: "0 pts",
      footer: "Something went wrong with your team.",
      accent: "pink",
    };
  }

  const startingXI = picks.filter((p) => p.position <= 11 && !p.is_captain);

  const captainPlayer = bootstrap.elements.find((p) => p.id === captainPick.element);
  const captainPoints = await getPlayerGwPoints(captainPick.element, eventId, bootstrap);
  const multiplier = captainPick.is_captain ? Math.max(captainPick.multiplier, 2) : captainPick.multiplier;
  const captainTotal = captainPoints * multiplier;

  let bestAltName = "";
  let bestAltPoints = 0;

  for (const pick of startingXI) {
    const pts = await getPlayerGwPoints(pick.element, eventId, bootstrap);
    const total = pts * 2;
    if (total > bestAltPoints) {
      bestAltPoints = total;
      const player = bootstrap.elements.find((p) => p.id === pick.element);
      bestAltName = player?.web_name || `Player ${pick.element}`;
    }
  }

  const isMasterclass = captainTotal >= bestAltPoints;
  const captainName = captainPlayer?.web_name || `Player ${captainPick.element}`;

  const delta = (bestAltPoints || 0) - captainTotal;

  let tagline = "Armband malpractice.";
  if (delta >= 25) {
    tagline = "The board has seen enough.";
  } else if (delta >= 15) {
    tagline = "Time for new management.";
  }

  console.log(`[Captaincy] captain=${captainTotal}, bestAlt=${bestAltPoints}, delta=${delta}, tagline="${tagline}"`);

  return {
    id: "captaincy",
    title: isMasterclass ? "CAPTAINCY MASTERCLASS" : "CAPTAINCY CRISIS",
    subtitle: `You captained ${captainName}`,
    tagline: isMasterclass ? "Elite decision-making." : tagline,
    bigValue: `${captainTotal} pts`,
    footer: isMasterclass ? "Nailed it. Best possible choice." : `Best alternative: ${bestAltName} for ${bestAltPoints} pts`,
    accent: isMasterclass ? "green" : "pink",
    meta: {
      captain_id: captainPick.element,
      captain_name: captainName,
      captain_points: captainTotal,
      best_alt_name: bestAltName,
      best_alt_points: bestAltPoints,
      delta: delta,
    },
  };
}

// -------------------------
// Card 2: BENCHED BLESSING
// -------------------------
async function buildBenchCard(picks: FplPick[], eventId: number, bootstrap: FplBootstrapStatic): Promise<FplCard> {
  const benchPicks = picks.filter((p) => p.position > 11);

  let topBenchName = "";
  let topBenchPoints = 0;
  let totalBenchPoints = 0;

  for (const pick of benchPicks) {
    const pts = await getPlayerGwPoints(pick.element, eventId, bootstrap);
    totalBenchPoints += pts;

    if (pts > topBenchPoints) {
      topBenchPoints = pts;
      const player = bootstrap.elements.find((p) => p.id === pick.element);
      topBenchName = player?.web_name || `Player ${pick.element}`;
    }
  }

  return {
    id: "bench",
    title: "BENCHED BLESSING",
    subtitle: topBenchName ? `${topBenchName} watched from the bench.` : "Your bench was empty.",
    bigValue: `${topBenchPoints} pts`,
    footer: `${totalBenchPoints} bench points left to rot.`,
    accent: "blue",
    meta: {
      top_bench_name: topBenchName,
      top_bench_points: topBenchPoints,
      total_bench_points: totalBenchPoints,
    },
  };
}

// -------------------------
// Card 3: TRANSFER TRAUMA / SUSPICIOUS RESTRAINT
// -------------------------
function buildTransferCard(entryHistory: FplEntryPicks["entry_history"]): FplCard {
  const hitCost = entryHistory.event_transfers_cost || 0;
  const transferCount = entryHistory.event_transfers || 0;

  if (hitCost > 0) {
    return {
      id: "transfers",
      title: "TRANSFER TRAUMA",
      subtitle: "This week's transfer damage:",
      bigValue: `-${hitCost} pts`,
      footer: `You paid points to make it worse. (${transferCount} transfer${transferCount === 1 ? "" : "s"})`,
      accent: "pink",
      meta: { hit_cost: hitCost, transfer_count: transferCount },
    };
  }

  return {
    id: "transfers",
    title: "SUSPICIOUS RESTRAINT",
    subtitle: "This week's transfer damage:",
    bigValue: "0 pts",
    footer: `Somehow you didn't panic. (${transferCount} free transfer${transferCount === 1 ? "" : "s"})`,
    accent: "green",
    meta: { hit_cost: 0, transfer_count: transferCount },
  };
}

// -------------------------
// Card 4: DIFFERENTIAL DISASTER
// -------------------------
async function buildDifferentialCard(picks: FplPick[], eventId: number, bootstrap: FplBootstrapStatic): Promise<FplCard> {
  const starters = picks.filter((p) => p.position <= 11);

  let lowestOwned: { name: string; points: number; ownership: number; id: number } | null = null;

  for (const pick of starters) {
    const player = bootstrap.elements.find((p) => p.id === pick.element);
    if (!player) continue;

    const ownership = parseFloat(player.selected_by_percent) || 100;
    const pts = await getPlayerGwPoints(pick.element, eventId, bootstrap);

    if (
      !lowestOwned ||
      ownership < lowestOwned.ownership ||
      (ownership === lowestOwned.ownership && pts < lowestOwned.points)
    ) {
      lowestOwned = { name: player.web_name, points: pts, ownership, id: player.id };
    }
  }

  if (!lowestOwned) {
    return {
      id: "differential",
      title: "DIFFERENTIAL DISASTER",
      subtitle: "No starters found",
      bigValue: "0 pts",
      footer: "Something went wrong.",
      accent: "orange",
    };
  }

  const isSuccess = lowestOwned.points >= 6;

  return {
    id: "differential",
    title: isSuccess ? "DIFFERENTIAL DELIGHT" : "DIFFERENTIAL DISASTER",
    subtitle: `${lowestOwned.name} - only ${lowestOwned.ownership}% own him.`,
    bigValue: `${lowestOwned.points} pts`,
    footer: isSuccess ? "The gamble paid off. For once." : "Bold pick. Wrong pick.",
    accent: isSuccess ? "green" : "orange",
    meta: { player_id: lowestOwned.id, player_name: lowestOwned.name, points: lowestOwned.points, ownership: lowestOwned.ownership },
  };
}

// -------------------------
// Get current/latest gameweek (current in progress, or most recent finished)
// -------------------------
export async function getCurrentGameweek(): Promise<number> {
  const bootstrap = await getBootstrapStatic();

  const current = bootstrap.events.find((e) => e.is_current);
  if (current) return current.id;

  const finishedEvents = bootstrap.events.filter((e) => e.finished);
  if (finishedEvents.length > 0) return finishedEvents[finishedEvents.length - 1].id;

  return 1;
}

// -------------------------
// Main FPL Roast handler
// -------------------------
export async function handleFplRoast(params: FplRoastRequest): Promise<FplRoastResponse> {
  const { entryId, eventId } = params;

  const bootstrap = await getBootstrapStatic();

  const event = bootstrap.events.find((e) => e.id === eventId);
  if (!event) throw new Error("FPL data for that gameweek isn't available yet.");

  let entry: FplEntry;
  try {
    entry = await getEntry(entryId);
  } catch (e: any) {
    if (e.message === "NOT_FOUND") throw new Error("Manager ID not found.");
    throw e;
  }

  let picks: FplEntryPicks;
  try {
    picks = await getEntryPicks(entryId, eventId);
  } catch (e: any) {
    if (e.message === "NOT_FOUND") throw new Error("FPL data for that gameweek isn't available yet.");
    throw e;
  }

  const cards: FplCard[] = await Promise.all([
    buildVerdictCard(entryId, eventId, picks.picks, picks.active_chip, picks.entry_history),
    buildCaptaincyCard(picks.picks, eventId, bootstrap),
    buildBenchCard(picks.picks, eventId, bootstrap),
    Promise.resolve(buildTransferCard(picks.entry_history)),
    buildDifferentialCard(picks.picks, eventId, bootstrap),
  ]);

  return {
    entry: {
      id: entry.id,
      name: entry.name,
      player_first_name: entry.player_first_name,
      player_last_name: entry.player_last_name,
    },
    eventId,
    cards,
  };
}