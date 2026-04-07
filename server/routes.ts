// server/routes.ts
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import type { Server } from "http";
import {
  roastRequestSchema,
  leagueAutopsyRequestSchema,
  fplRoastRequestSchema,
  type RoastRequest,
  type RoastResponse,
  type LeagueAutopsyResponse,
} from "@shared/schema";
import { handleFplRoast, getCurrentGameweek } from "./fpl";
import {
  recordEvent,
  getTotals,
  getRecentEvents,
  getFirstStartedAt,
  isUsingDatabase,
  ensureDb,
  getAnalyticsSummary,
  hashIp,
  type RecordEventOptions,
} from "./analytics-db";

// ✅ NEW: League History (Dominance Grid)
import { handleLeagueHistoryDominance } from "./league-history";
import { selectTagline } from "./lib/seasonTagline";
import { getWeeklyCommissionerEmail, generateWeeklyCommissionerEmail, getRecapSubject } from "./lib/weeklyCommissioner";
import { buildTeamsFromSleeper } from "./lib/weeklyCommissioner";
import { generatePowerRankings } from "./lib/powerRankings";
import { sendEmail } from "./lib/emailSender";
import { getStoredPreviousRankings, storeRankingsForWeek } from "./lib/weeklyRankingsStore";
import { recordSent, getSentRecord } from "./lib/weeklyReportStore";
import { generateWeeklyEmailPlainText } from "./lib/weeklyEmail";
import { selectCardCopy, interpolateTagline } from "./lib/cardCopy";
import { buildWeeklyRoastNarrative } from "./lib/weeklyRoastEngine";
import {
  DEMO_LEAGUE_ID as STATIC_DEMO_LEAGUE_ID,
  getDemoLeagueTeams,
  getDemoWeeklyRoast,
  getDemoWrapped,
  getDemoAutopsy,
  getDemoWeeklyEmailPayload,
  getDemoWeeklyPreviewPayload,
} from "./league-history/demoLeague";
import { generateWeeklyEmail } from "./lib/weeklyEmail";
import { getWeeklyPreviewEmail, generateWeeklyPreviewEmail } from "./lib/weeklyPreview";
import {
  isLeagueUnlocked as isLeagueUnlockedPersistent,
  markLeagueUnlocked,
  hasUsedFreeSend,
  markFreeSendUsed,
  getFreeSendStatus,
} from "./lib/entitlementsStore";

// -------------------------
// Analytics (PostgreSQL-backed with in-memory fallback)
// -------------------------
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

/**
 * Public origin for email images and absolute links when generating HTML for this request.
 * Replit/proxies set X-Forwarded-*; default CLIENT_URL is localhost and breaks &lt;img src&gt; on Replit.
 */
function publicAppUrl(req: Request): string {
  const forwardedHost = req.get("x-forwarded-host");
  const host = (forwardedHost || req.get("host") || "").trim();
  if (host) {
    const rawProto = req.get("x-forwarded-proto");
    const proto =
      rawProto === "http" || rawProto === "https"
        ? rawProto
        : host.includes("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
    return `${proto}://${host.replace(/\/$/, "")}`;
  }
  return CLIENT_URL.replace(/\/$/, "");
}
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" })
  : null;
const serverStartedAt = Date.now();
const WEEKLY_EMAIL_V2_ENABLED = String(process.env.WEEKLY_EMAIL_V2_ENABLED || "false").toLowerCase() === "true";
const unlockedLeagueIds = new Set<string>();

// Initialize DB on startup (async, runs in background)
ensureDb().catch((err) => console.error("[Analytics] DB init error:", err));

function trackEvent(
  type: string,
  route: string,
  method: string,
  meta?: Record<string, any>,
  options?: RecordEventOptions
) {
  recordEvent(type, route, method, Date.now(), meta || {}, options || {}).catch((err) =>
    console.error("[Analytics] recordEvent error:", err),
  );
  // Log without sensitive data (no IP, truncate user_agent)
  const logMeta = meta ? { ...meta } : {};
  console.log(`[Analytics] ${type} ${method} ${route}`, logMeta);
}

// Helper to extract request context for analytics
function getRequestContext(req: Request): RecordEventOptions {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
    || req.socket?.remoteAddress 
    || "";
  return {
    user_agent: (req.headers["user-agent"] || "").slice(0, 256), // Truncate for storage
    ip_hash: hashIp(ip),
  };
}

// -------------------------
// Demo league config (optional, for offseason weekly roast)
// -------------------------
const DEMO_LEAGUE_ID = process.env.DEMO_LEAGUE_ID || "";
const DEMO_WEEK = Number(process.env.DEMO_WEEK || 17);

// -------------------------
// Sleeper helpers
// -------------------------
async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Sleeper API ${res.status}: ${text || url}`);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Sleeper API timeout after ${timeoutMs}ms: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

type SleeperLeague = {
  league_id: string;
  name: string;
  season?: string;
  settings?: {
    playoff_week_end?: number;
  };
};

type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    rank?: number;
  };
};

type SleeperUser = {
  user_id: string;
  username: string;
  display_name?: string;
};

type SleeperMatchup = {
  matchup_id: number;
  roster_id: number;
  points: number;

  // IMPORTANT: these exist in Sleeper matchups payloads
  starters?: string[];
  players?: string[];
  players_points?: Record<string, number>;
  starters_points?: Record<string, number>;
};

type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
};

let NFL_PLAYERS_CACHE: Record<string, SleeperPlayer> | null = null;
let NFL_PLAYERS_CACHE_TS = 0;

async function getNflPlayers(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // cache for 24h
  if (NFL_PLAYERS_CACHE && now - NFL_PLAYERS_CACHE_TS < ONE_DAY) {
    return NFL_PLAYERS_CACHE;
  }

  // This is a large payload, allow more time
  const players = await fetchJson<Record<string, SleeperPlayer>>(
    "https://api.sleeper.app/v1/players/nfl",
    30000,
  );

  NFL_PLAYERS_CACHE = players;
  NFL_PLAYERS_CACHE_TS = now;
  return players;
}

async function playerLabel(playerId: string | number | null | undefined) {
  if (!playerId) return "Unknown player";
  const id = String(playerId);

  try {
    const players = await getNflPlayers();
    const p = players[id];
    if (!p) return `Player ${id}`;

    const name =
      p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || `Player ${id}`;

    // Optional extra flavor:
    const meta = [p.position, p.team].filter(Boolean).join(" • ");
    return meta ? `${name} (${meta})` : name;
  } catch {
    // if players endpoint fails, fall back gracefully
    return `Player ${id}`;
  }
}

// -------------------------
// Utility helpers
// -------------------------
function safeNumber(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function isNoMatchupError(msg: string) {
  return msg.toLowerCase().includes("no matchup data found");
}

function buildUserMap(users: SleeperUser[]) {
  const userById = new Map<string, SleeperUser>();
  for (const u of users) userById.set(u.user_id, u);
  return userById;
}

function rosterDisplayName(rosters: SleeperRoster[], userById: Map<string, SleeperUser>, rid: number) {
  const r = rosters.find((x) => x.roster_id === rid);
  const owner = r?.owner_id ? userById.get(r.owner_id) : null;
  return owner?.display_name || owner?.username || `Roster ${rid}`;
}

function pfFromRoster(r?: SleeperRoster) {
  const base = r?.settings?.fpts ?? 0;
  const dec = r?.settings?.fpts_decimal ?? 0;
  return base + dec / 100;
}

function paFromRoster(r?: SleeperRoster) {
  const base = r?.settings?.fpts_against ?? 0;
  const dec = r?.settings?.fpts_against_decimal ?? 0;
  return base + dec / 100;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function formatPts(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

// -------------------------
// Option A: resolve roster_id by username/display_name
// -------------------------
async function resolveRosterByUsername(
  league_id: string,
  username: string,
): Promise<{ roster_id: number; team_name?: string } | null> {
  const [rosters, users] = await Promise.all([
    fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${league_id}/users`),
  ]);

  const needle = username.trim().toLowerCase();
  const user = users.find(
    (u) => u.username?.toLowerCase() === needle || u.display_name?.toLowerCase() === needle,
  );
  if (!user) return null;

  const roster = rosters.find((r) => r.owner_id === user.user_id);
  if (!roster) return null;

  return {
    roster_id: roster.roster_id,
    team_name: user.display_name || user.username,
  };
}

// -------------------------
// Option B: dropdown list of teams/rosters
// -------------------------
async function handleLeagueTeams(league_id: string) {
  const [rosters, users] = await Promise.all([
    fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${league_id}/users`),
  ]);

  const userById = buildUserMap(users);

  const teams = rosters
    .map((r) => ({
      roster_id: r.roster_id,
      name: rosterDisplayName(rosters, userById, r.roster_id),
    }))
    .sort((a, b) => a.roster_id - b.roster_id);

  return { league_id, teams };
}

// -------------------------
// Core weekly roast logic (league-wide)
// -------------------------
async function handleRoast(params: RoastRequest): Promise<RoastResponse> {
  const { league_id, week, roster_id } = params;

  const [league, rosters, users, matchups] = await Promise.all([
    fetchJson<SleeperLeague>(`https://api.sleeper.app/v1/league/${league_id}`),
    fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${league_id}/users`),
    fetchJson<SleeperMatchup[]>(`https://api.sleeper.app/v1/league/${league_id}/matchups/${week}`),
  ]);

  if (!matchups?.length) {
    throw new Error(`No matchup data found for week ${week}.`);
  }

  const userById = buildUserMap(users);
  const rosterName = (rid: number) => rosterDisplayName(rosters, userById, rid);

  const narrative = await buildWeeklyRoastNarrative({
    league: { league_id: league.league_id, name: league.name, season: league.season },
    week,
    matchups,
    rosterName,
  });

  const payload: RoastResponse = {
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
    },
    week,
    headline: narrative.headline,
    stats: narrative.stats,
    cards: narrative.cards,
    groupChatSummary: narrative.groupChatSummary,
    signals: narrative.signals,
  };

  // Optional matchup section if roster_id provided (kept for later “Roast My Matchup”)
  if (typeof roster_id === "number") {
    const yourRow = matchups.find((m) => m.roster_id === roster_id);
    if (yourRow) {
      const yourMatchupId = yourRow.matchup_id;
      const opponentRow = matchups.find(
        (m) => m.matchup_id === yourMatchupId && m.roster_id !== roster_id,
      );

      if (opponentRow) {
        const youScore = safeNumber(yourRow.points);
        const oppScore = safeNumber(opponentRow.points);

        const result: "WIN" | "LOSS" | "TIE" =
          youScore > oppScore ? "WIN" : youScore < oppScore ? "LOSS" : "TIE";

        payload.matchup = {
          roster_id,
          opponent_roster_id: opponentRow.roster_id,
          you: { username: rosterDisplayName(rosters, userById, roster_id), score: youScore },
          opponent: {
            username: rosterDisplayName(rosters, userById, opponentRow.roster_id),
            score: oppScore,
          },
          result,
        };
      }
    }
  }

  return payload;
}

// -------------------------
// Weekly roast fallback wrapper (demo only for offseason/no matchups)
// -------------------------
async function handleRoastWithFallback(params: RoastRequest) {
  try {
    const payload = await handleRoast(params);
    return {
      mode: "LIVE" as const,
      fallback_reason: null as string | null,
      ...payload,
    };
  } catch (err: any) {
    const msg = err?.message || "Failed to fetch roast";
    if (!isNoMatchupError(msg)) throw err;

    if (!DEMO_LEAGUE_ID) throw err;

    const demoPayload = await handleRoast({
      ...params,
      league_id: DEMO_LEAGUE_ID,
      week: DEMO_WEEK,
    });

    return {
      mode: "DEMO" as const,
      fallback_reason: "NO_MATCHUPS_OR_OFFSEASON",
      ...demoPayload,
      requested: {
        league_id: params.league_id,
        week: params.week,
        roster_id: params.roster_id,
      },
    };
  }
}

// -------------------------
// Season Wrapped: real season truth + real season cards
// -------------------------
async function handleWrapped(params: RoastRequest) {
  const { league_id, roster_id } = params;

  if (typeof roster_id !== "number") {
    return {
      league_id,
      roster_id: 1,
      wrapped: {
        season: {
          record: "0-0",
          rank: undefined,
          points_for: 0,
          points_against: 0,
        },
        cards: [
          {
            type: "error",
            title: "Pick your roster",
            subtitle: "Select your team so we can generate a real Season Wrapped.",
          },
        ],
      },
      mode: "DEMO" as const,
      fallback_reason: "MISSING_ROSTER_ID",
    };
  }

  const rid = roster_id;

  const [league, rosters, users] = await Promise.all([
    fetchJson<SleeperLeague>(`https://api.sleeper.app/v1/league/${league_id}`),
    fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${league_id}/users`),
  ]);

  const userById = buildUserMap(users);
  const displayName = rosterDisplayName(rosters, userById, rid);
  const r = rosters.find((x) => x.roster_id === rid);

  // Real season stats from roster settings
  const wins = r?.settings?.wins ?? 0;
  const losses = r?.settings?.losses ?? 0;
  const ties = r?.settings?.ties ?? 0;

  const rankFromSleeper = typeof r?.settings?.rank === "number" ? r.settings.rank : undefined;
  const record = ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

  const pointsFor = pfFromRoster(r);
  const pointsAgainst = paFromRoster(r);

  // Derive season week range
  const endWeek = league?.settings?.playoff_week_end ?? 17;
  const startWeek = 1;

  // Walk season matchups and compute:
  // - season MVP player (top total points for roster)
  // - best win margin, worst loss margin for roster
  const playerTotals = new Map<string, number>();
  let bestWin: { week: number; margin: number; oppRid: number; you: number; opp: number } | null =
    null;
  let worstLoss: { week: number; margin: number; oppRid: number; you: number; opp: number } | null =
    null;
  // Track record vs each opponent for "Your Worst Enemy" card
  const recordVsOpponent = new Map<number, { wins: number; losses: number }>();
  // Track choke jobs (lost while scoring above weekly median) - aligned with storylines.ts
  const MAX_CHOKE_JOBS = 5;
  const chokeJobs: Array<{
    week: number;
    you: number;
    opp: number;
    oppRid: number;
    isNuclear: boolean;
    rank: number;
  }> = [];
  // Store weekly scores and user losses for post-processing
  const weeklyScores = new Map<number, number[]>();
  const userLosses: Array<{ week: number; you: number; opp: number; oppRid: number }> = [];

  for (let w = startWeek; w <= endWeek; w++) {
    let weekMatchups: SleeperMatchup[] = [];
    try {
      weekMatchups = await fetchJson<SleeperMatchup[]>(
        `https://api.sleeper.app/v1/league/${league_id}/matchups/${w}`,
      );
    } catch {
      continue;
    }
    if (!weekMatchups?.length) continue;

    // Collect all scores for this week to calculate median
    const allScores: number[] = [];
    for (const m of weekMatchups) {
      const pts = safeNumber(m.points);
      if (pts > 0) allScores.push(pts);
    }
    if (allScores.length > 0) {
      weeklyScores.set(w, allScores);
    }

    const yourRow = weekMatchups.find((m) => m.roster_id === rid);
    if (!yourRow) continue;

    // accumulate player totals (from players_points if present)
    const pp = yourRow.players_points || yourRow.starters_points || {};
    for (const [pid, ptsRaw] of Object.entries(pp)) {
      const pts = safeNumber(ptsRaw);
      if (pts <= 0) continue;
      playerTotals.set(pid, (playerTotals.get(pid) || 0) + pts);
    }

    // compute win/loss margin for the roster that week
    const oppRow = weekMatchups.find(
      (m) => m.matchup_id === yourRow.matchup_id && m.roster_id !== rid,
    );
    if (!oppRow) continue;

    const you = safeNumber(yourRow.points);
    const opp = safeNumber(oppRow.points);
    const margin = you - opp;

    // Track record vs each opponent
    const oppRid = oppRow.roster_id;
    const rec = recordVsOpponent.get(oppRid) || { wins: 0, losses: 0 };

    if (margin > 0) {
      rec.wins++;
      if (!bestWin || margin > bestWin.margin) {
        bestWin = { week: w, margin, oppRid, you, opp };
      }
    } else if (margin < 0) {
      rec.losses++;
      if (!worstLoss || margin < worstLoss.margin) {
        worstLoss = { week: w, margin, oppRid, you, opp };
      }
      // Track loss for choke job analysis
      userLosses.push({ week: w, you, opp, oppRid });
    }
    recordVsOpponent.set(oppRid, rec);
  }

  // Process choke jobs: lost while scoring above weekly median
  for (const loss of userLosses) {
    const scores = weeklyScores.get(loss.week);
    if (!scores || scores.length === 0) continue;

    const sorted = [...scores].sort((a, b) => b - a);
    const medianIndex = Math.floor(sorted.length / 2);
    const median = sorted[medianIndex];
    const rank = sorted.indexOf(loss.you) + 1; // 1-indexed rank
    const isTop3 = rank <= 3;

    // Choke job = lost while scoring above the weekly median
    if (loss.you > median) {
      chokeJobs.push({ ...loss, isNuclear: isTop3, rank });
    }
  }

  // Cap at MAX_CHOKE_JOBS, prioritize nuclear tier then highest score
  const cappedChokes = [...chokeJobs]
    .sort((a, b) => (b.isNuclear ? 1 : 0) - (a.isNuclear ? 1 : 0) || b.you - a.you)
    .slice(0, MAX_CHOKE_JOBS);

  // Find worst enemy (opponent with best record against user)
  // Must have a WINNING record against user to qualify (aligned with grid NEMESIS logic)
  let worstEnemy: { rosterId: number; wins: number; losses: number } | null = null;
  for (const [oppId, rec] of Array.from(recordVsOpponent.entries())) {
    const theirWins = rec.losses; // Their wins against user = user's losses to them
    const theirLosses = rec.wins; // Their losses to user = user's wins against them
    // Only qualify if they have a winning record against user (no ties like 1-1)
    if (theirWins > theirLosses && (!worstEnemy || theirWins > worstEnemy.wins)) {
      worstEnemy = { rosterId: oppId, wins: theirWins, losses: theirLosses };
    }
  }

  // season MVP player: top accumulated points
  let mvpPlayerId = "";
  let mvpPoints = -Infinity;
  for (const [pid, pts] of Array.from(playerTotals.entries())) {
    if (pts > mvpPoints) {
      mvpPoints = pts;
      mvpPlayerId = pid;
    }
  }

  const mvpName = await playerLabel(mvpPlayerId);
  const rosterName = (id: number) => rosterDisplayName(rosters, userById, id);

  // rank fallback if Sleeper rank missing: sort by wins then pointsFor
  let derivedRank: number | undefined = rankFromSleeper;
  if (!derivedRank) {
    const sorted = [...rosters].sort((a, b) => {
      const aw = a.settings?.wins ?? 0;
      const bw = b.settings?.wins ?? 0;
      if (bw !== aw) return bw - aw;

      const apf = pfFromRoster(a);
      const bpf = pfFromRoster(b);
      return bpf - apf;
    });
    const idx = sorted.findIndex((x) => x.roster_id === rid);
    if (idx >= 0) derivedRank = idx + 1;
  }

  // Generate tagline for season summary (safe by default, spicy for premium)
  const taglineResult = selectTagline({
    wins,
    losses,
    ties,
    rank: derivedRank ?? rosters.length,
    leagueSize: rosters.length,
    pointsFor,
    pointsAgainst,
    leagueId: league_id,
  });

  const cards = [
    {
      type: "season_summary",
      title: "Season Summary",
      subtitle: derivedRank
        ? `#${derivedRank} of ${rosters.length} teams`
        : `${displayName} season recap`,
      stat: record,
      meta: {
        rank: derivedRank,
        leagueSize: rosters.length,
        pointsFor: Math.round(pointsFor),
        pointsAgainst: Math.round(pointsAgainst),
        tagline: taglineResult.tagline,
        taglineBucket: taglineResult.bucket,
      },
    },
    {
      type: "season_mvp",
      title: "Team MVP",
      subtitle: mvpName === "No data" ? "Couldn’t read player points for this league." : mvpName,
      stat: `${mvpPoints.toFixed(1)} pts`,
      meta: {
        tagline: selectCardCopy("season_mvp", league_id).tagline,
      },
    },
    {
      type: "best_win",
      title: "Biggest Win",
      subtitle: bestWin
        ? `Week ${bestWin.week}: ${interpolateTagline(selectCardCopy("best_win", league_id).tagline, { opponent: rosterName(bestWin.oppRid) })}`
        : "No wins found in this season range.",
      stat: bestWin ? `+${formatPts(bestWin.margin)} pts` : "—",
      meta: bestWin
        ? {
            week: bestWin.week,
            margin: Number(formatPts(bestWin.margin)),
            opponent: rosterName(bestWin.oppRid),
            you: Number(formatPts(bestWin.you)),
            opp: Number(formatPts(bestWin.opp)),
          }
        : null,
    },
    // Your Worst Enemy card - always show
    {
      type: "worst_enemy",
      title: "Your Worst Enemy",
      subtitle: worstEnemy
        ? interpolateTagline(selectCardCopy("worst_enemy", league_id).tagline, { name: rosterName(worstEnemy.rosterId) })
        : "No one owns you. You ran the table.",
      stat: worstEnemy ? `${worstEnemy.wins}-${worstEnemy.losses}` : "0-0",
      meta: worstEnemy
        ? {
            opponent: rosterName(worstEnemy.rosterId),
            opponentWins: worstEnemy.wins,
            opponentLosses: worstEnemy.losses,
          }
        : null,
    },
    // Your Choke Jobs card - aligned with storylines.ts (weekly median + nuclear tier)
    {
      type: "choke_jobs",
      title: "Your Choke Jobs",
      subtitle: (() => {
        if (cappedChokes.length === 0) {
          return `Zero choke jobs. ${selectCardCopy("choke_jobs", league_id).tagline}`;
        }
        const nuclearCount = cappedChokes.filter((c) => c.isNuclear).length;
        const worstChoke = cappedChokes[0];
        if (nuclearCount > 0 && worstChoke.isNuclear) {
          return nuclearCount === 1
            ? `Top ${worstChoke.rank} scorer. Still lost to ${rosterName(worstChoke.oppRid)}.`
            : `${nuclearCount} times you were a top 3 scorer and still lost.`;
        }
        return cappedChokes.length === 1
          ? `Beat half the league and lost to ${rosterName(worstChoke.oppRid)}.`
          : `${cappedChokes.length} times you beat half the league and lost.`;
      })(),
      stat: `${cappedChokes.length}`,
      meta:
        cappedChokes.length > 0
          ? {
              count: cappedChokes.length,
              nuclearCount: cappedChokes.filter((c) => c.isNuclear).length,
              games: cappedChokes.map((g) => ({
                week: g.week,
                you: g.you,
                opp: g.opp,
                opponent: rosterName(g.oppRid),
                isNuclear: g.isNuclear,
                rank: g.rank,
              })),
            }
          : null,
    },
  ];

  return {
    league_id,
    roster_id: rid,
    league: { league_id: league.league_id, name: league.name, season: league.season },
    wrapped: {
      season: {
        record,
        rank: derivedRank,
        points_for: Math.round(pointsFor),
        points_against: Math.round(pointsAgainst),
      },
      cards,
    },
    mode: "LIVE" as const,
    fallback_reason: null as string | null,
  };
}

function bestLossAbs(margin: number) {
  return Math.abs(margin);
}

// -------------------------
// League Autopsy: 5 season-wide league stats
// -------------------------
async function handleLeagueAutopsy(params: { league_id: string }): Promise<LeagueAutopsyResponse> {
  const { league_id } = params;

  const [league, rosters, users] = await Promise.all([
    fetchJson<SleeperLeague>(`https://api.sleeper.app/v1/league/${league_id}`),
    fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${league_id}/users`),
  ]);

  const userById = buildUserMap(users);
  const rosterName = (rid: number) => rosterDisplayName(rosters, userById, rid);

  const endWeek = league?.settings?.playoff_week_end ?? 17;
  const startWeek = 1;

  let lastPlaceRoster: SleeperRoster | null = null;
  let seasonHighScore: { roster_id: number; week: number; points: number } | null = null;
  let seasonLowScore: { roster_id: number; week: number; points: number } | null = null;
  let biggestBlowout:
    | {
        winner_rid: number;
        loser_rid: number;
        week: number;
        winner_score: number;
        loser_score: number;
        margin: number;
      }
    | null = null;
  let highestScoreInLoss:
    | { roster_id: number; week: number; points: number; opp_rid: number; opp_points: number }
    | null = null;

  for (let w = startWeek; w <= endWeek; w++) {
    let weekMatchups: SleeperMatchup[] = [];
    try {
      weekMatchups = await fetchJson<SleeperMatchup[]>(
        `https://api.sleeper.app/v1/league/${league_id}/matchups/${w}`,
      );
    } catch {
      continue;
    }
    if (!weekMatchups?.length) continue;

    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of weekMatchups) {
      if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
      byMatchup.get(m.matchup_id)!.push(m);
    }

    for (const m of weekMatchups) {
      const pts = safeNumber(m.points);

      if (!seasonHighScore || pts > seasonHighScore.points) {
        seasonHighScore = { roster_id: m.roster_id, week: w, points: pts };
      }

      if (!seasonLowScore || pts < seasonLowScore.points) {
        seasonLowScore = { roster_id: m.roster_id, week: w, points: pts };
      }
    }

    for (const [, rows] of Array.from(byMatchup.entries())) {
      if (rows.length < 2) continue;
      const a = rows[0]!;
      const b = rows[1]!;
      const aPts = safeNumber(a.points);
      const bPts = safeNumber(b.points);
      const winner = aPts >= bPts ? a : b;
      const loser = aPts >= bPts ? b : a;
      const winnerPts = Math.max(aPts, bPts);
      const loserPts = Math.min(aPts, bPts);
      const margin = winnerPts - loserPts;

      if (!biggestBlowout || margin > biggestBlowout.margin) {
        biggestBlowout = {
          winner_rid: winner.roster_id,
          loser_rid: loser.roster_id,
          week: w,
          winner_score: winnerPts,
          loser_score: loserPts,
          margin,
        };
      }

      if (loserPts > 0 && (!highestScoreInLoss || loserPts > highestScoreInLoss.points)) {
        highestScoreInLoss = {
          roster_id: loser.roster_id,
          week: w,
          points: loserPts,
          opp_rid: winner.roster_id,
          opp_points: winnerPts,
        };
      }
    }
  }

  const sortedRosters = [...rosters].sort((a, b) => {
    const aw = a.settings?.wins ?? 0;
    const bw = b.settings?.wins ?? 0;
    if (aw !== bw) return aw - bw;
    const apf = pfFromRoster(a);
    const bpf = pfFromRoster(b);
    return apf - bpf;
  });
  lastPlaceRoster = sortedRosters[0] || null;

  const cards: any[] = [];

  if (lastPlaceRoster) {
    const wins = lastPlaceRoster.settings?.wins ?? 0;
    const losses = lastPlaceRoster.settings?.losses ?? 0;
    const ties = lastPlaceRoster.settings?.ties ?? 0;
    const record = ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
    const teamName = rosterName(lastPlaceRoster.roster_id);
    cards.push({
      type: "last_place",
      title: "THE BODY",
      subtitle: `${teamName} finished #${rosters.length}`,
      tagline: selectCardCopy("last_place", league_id).tagline,
      stat: record,
      meta: {
        roster_id: lastPlaceRoster.roster_id,
        rank: rosters.length,
        record,
        team: teamName,
      },
    });
  }

  if (seasonHighScore) {
    const teamName = rosterName(seasonHighScore.roster_id);
    cards.push({
      type: "season_high",
      title: "PEAK DELUSION",
      subtitle: `${teamName} in Week ${seasonHighScore.week}`,
      tagline: selectCardCopy("season_high", league_id).tagline,
      stat: formatPts(seasonHighScore.points),
      meta: {
        roster_id: seasonHighScore.roster_id,
        week: seasonHighScore.week,
        points: seasonHighScore.points,
        team: teamName,
      },
    });
  }

  if (seasonLowScore) {
    const teamName = rosterName(seasonLowScore.roster_id);
    cards.push({
      type: "season_low",
      title: "CRIME SCENE",
      subtitle: `${teamName} in Week ${seasonLowScore.week}`,
      tagline: selectCardCopy("season_low", league_id).tagline,
      stat: formatPts(seasonLowScore.points),
      meta: {
        roster_id: seasonLowScore.roster_id,
        week: seasonLowScore.week,
        points: seasonLowScore.points,
        team: teamName,
      },
    });
  }

  if (biggestBlowout) {
    const winnerName = rosterName(biggestBlowout.winner_rid);
    const loserName = rosterName(biggestBlowout.loser_rid);
    cards.push({
      type: "biggest_blowout_season",
      title: "MERCY RULE",
      subtitle: `${winnerName} ${formatPts(biggestBlowout.winner_score)} vs ${loserName} ${formatPts(
        biggestBlowout.loser_score,
      )}`,
      tagline: selectCardCopy("biggest_blowout", league_id).tagline,
      stat: `+${formatPts(biggestBlowout.margin)}`,
      meta: {
        week: biggestBlowout.week,
        winner: winnerName,
        loser: loserName,
        winner_score: biggestBlowout.winner_score,
        loser_score: biggestBlowout.loser_score,
        margin: biggestBlowout.margin,
      },
    });
  }

  if (highestScoreInLoss) {
    const teamName = rosterName(highestScoreInLoss.roster_id);
    const oppName = rosterName(highestScoreInLoss.opp_rid);
    const lossMargin = highestScoreInLoss.opp_points - highestScoreInLoss.points;
    cards.push({
      type: "highest_loss",
      title: "FANTASY INJUSTICE",
      subtitle: `${teamName} (${formatPts(highestScoreInLoss.points)}) lost to ${oppName} (${formatPts(
        highestScoreInLoss.opp_points,
      )}) in Week ${highestScoreInLoss.week}`,
      tagline: selectCardCopy("highest_loss", league_id).tagline,
      stat: `-${formatPts(lossMargin)}`,
      meta: {
        roster_id: highestScoreInLoss.roster_id,
        week: highestScoreInLoss.week,
        points: highestScoreInLoss.points,
        team: teamName,
        opponent: oppName,
        opponent_score: highestScoreInLoss.opp_points,
      },
    });
  }

  return {
    league_id,
    league: {
      league_id: league_id,
      name: "League",
      season: undefined,
    },
    cards,
    mode: "LIVE",
  };
}

// -------------------------
// Register routes
// -------------------------
export async function registerRoutes(httpServer: Server, app: Express) {
  app.get("/api/sleeper/leagues/:username/:season", async (req: Request, res: Response) => {
    try {
      const { username, season } = req.params;
      const user = await fetchJson<SleeperUser>(`https://api.sleeper.app/v1/user/${username}`);
      if (!user?.user_id) {
        return res.status(404).json({ error: "User not found on Sleeper." });
      }

      const leagues = await fetchJson<SleeperLeague[]>(
        `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${season}`,
      );

      const minimalLeagues = leagues.map((l) => ({
        league_id: l.league_id,
        name: l.name,
        season: l.season,
      }));

      res.json(minimalLeagues);
    } catch (error: any) {
      console.error("League fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch leagues" });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Option A: resolve roster_id by username/display_name
  app.get("/api/resolve-roster", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    const username = String(req.query.username || "").trim();

    if (!league_id || !username) {
      return res.status(400).json({ message: "league_id and username are required" });
    }

    try {
      const result = await resolveRosterByUsername(league_id, username);
      if (!result) return res.json({ league_id, username, roster_id: null });
      return res.json({
        league_id,
        username,
        roster_id: result.roster_id,
        team_name: result.team_name,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to resolve roster" });
    }
  });

  // Option B: dropdown list of teams/rosters
  app.get("/api/league-teams", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    if (!league_id) return res.status(400).json({ message: "league_id is required" });

    // Demo league intercept - return static fictional teams (no Sleeper API call)
    if (league_id === STATIC_DEMO_LEAGUE_ID) {
      return res.json(getDemoLeagueTeams());
    }

    try {
      const payload = await handleLeagueTeams(league_id);
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch league teams" });
    }
  });

  // Power Rankings (weekly commissioner) — GET
  app.get("/api/power-rankings", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    const week = Number(req.query.week || 0);
    if (!league_id || week < 1) {
      return res.status(400).json({ error: "league_id and week (>= 1) are required" });
    }
    if (league_id === STATIC_DEMO_LEAGUE_ID) {
      return res.status(400).json({ error: "Power rankings are not available for the demo league. Use a real Sleeper league ID." });
    }
    try {
      const { leagueName, teams } = await buildTeamsFromSleeper(league_id, week);
      const rankings = generatePowerRankings(teams);
      return res.json({ leagueName, week, rankings });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to generate power rankings" });
    }
  });

  // Weekly Commissioner Email — preview (returns HTML for browser). Query: mode=preview|recap (default recap).
  app.get("/api/leagues/:leagueId/weekly-email/preview", async (req: Request, res: Response) => {
    const leagueId = String(req.params.leagueId || "").trim();
    const week = Number(req.query.week) || 6;
    const note = typeof req.query.note === "string" ? req.query.note.trim() : undefined;
    const signoff = typeof req.query.signoff === "string" ? req.query.signoff.trim() : undefined;
    const mode = String(req.query.mode || "recap").toLowerCase() === "preview" ? "preview" : "recap";
    if (!leagueId) {
      return res.status(400).send("Missing leagueId.");
    }
    try {
      let html: string;
      const appOrigin = publicAppUrl(req);
      if (leagueId === STATIC_DEMO_LEAGUE_ID) {
        if (mode === "preview") {
          const demoPayload = getDemoWeeklyPreviewPayload(week);
          html = generateWeeklyEmail({ ...demoPayload, ...(note ? { commissionerNote: note } : {}), ...(signoff ? { commissionerSignoff: signoff.slice(0, 180) } : {}), appUrl: appOrigin });
        } else {
          const demoPayload = getDemoWeeklyEmailPayload(week);
          html = generateWeeklyEmail({ ...demoPayload, ...(note ? { commissionerNote: note } : {}), ...(signoff ? { commissionerSignoff: signoff.slice(0, 180) } : {}), appUrl: appOrigin });
        }
      } else {
        if (week < 1) return res.status(400).send("Week must be 1–18.");
        if (mode === "preview") {
          const result = await getWeeklyPreviewEmail(leagueId, week, note, signoff, appOrigin);
          html = result.emailHtml;
        } else {
          const previousRankings = getStoredPreviousRankings(leagueId, week);
          const result = await generateWeeklyCommissionerEmail(leagueId, week, previousRankings, note, signoff, appOrigin, WEEKLY_EMAIL_V2_ENABLED);
          html = result.html;
        }
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err: any) {
      return res.status(500).send(err?.message || "Failed to generate preview.");
    }
  });

  // Weekly Commissioner Email — send to commissioner only (V1). Body: mode = "recap" | "preview" (default recap).
  app.post("/api/leagues/:leagueId/weekly-email/send", async (req: Request, res: Response) => {
    const leagueId = String(req.params.leagueId || "").trim();
    const body = req.body || {};
    const week = Number(body.week || 0);
    const commissionerEmail = typeof body.commissioner_email === "string" ? body.commissioner_email.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : undefined;
    const signoff = typeof body.signoff === "string" ? body.signoff.trim().slice(0, 180) : undefined;
    const mode = body.mode === "preview" ? "preview" : "recap";
    if (!leagueId || week < 1) {
      return res.status(400).json({ error: "leagueId and week are required." });
    }
    if (!commissionerEmail) {
      return res.status(400).json({ error: "commissioner_email is required to send the weekly email." });
    }
    if (leagueId === STATIC_DEMO_LEAGUE_ID) {
      return res.status(400).json({ error: "Send is not available for the demo league." });
    }
    const isUnlockedLeague = unlockedLeagueIds.has(leagueId) || await isLeagueUnlockedPersistent(leagueId);
    if (!isUnlockedLeague && await hasUsedFreeSend(leagueId)) {
      console.log(JSON.stringify({ event: "weekly_email_send_denied", leagueId, week, mode, reason: "free_send_used" }));
      return res.status(402).json({ code: "FREE_SEND_USED", error: "You've used your free send. Unlock to send again." });
    }
    try {
      const appOrigin = publicAppUrl(req);
      if (mode === "preview") {
        const result = await generateWeeklyPreviewEmail(leagueId, week, note, signoff, appOrigin);
        const sendResult = await sendEmail({ to: commissionerEmail, subject: result.subject, html: result.html, text: result.text });
        if (!sendResult.ok) {
          return res.status(500).json({ error: sendResult.error || "Failed to send email." });
        }
        if (!isUnlockedLeague) await markFreeSendUsed(leagueId, commissionerEmail);
        console.log(JSON.stringify({ event: "weekly_email_send_allowed", leagueId, week, mode, unlocked: isUnlockedLeague }));
        recordSent(leagueId, week, commissionerEmail, "preview");
        return res.json({ ok: true, message: "Matchup preview sent to commissioner." });
      }
      const previousRankings = getStoredPreviousRankings(leagueId, week);
      const result = await getWeeklyCommissionerEmail(leagueId, week, previousRankings, note, signoff, appOrigin, WEEKLY_EMAIL_V2_ENABLED);
      const subject = getRecapSubject(result.leagueName, result.week, result.emailPayload);
      const text = generateWeeklyEmailPlainText(result.emailPayload);
      const sendResult = await sendEmail({ to: commissionerEmail, subject, html: result.emailHtml, text });
      if (!sendResult.ok) {
        return res.status(500).json({ error: sendResult.error || "Failed to send email." });
      }
      if (!isUnlockedLeague) await markFreeSendUsed(leagueId, commissionerEmail);
      console.log(JSON.stringify({ event: "weekly_email_send_allowed", leagueId, week, mode, unlocked: isUnlockedLeague }));
      storeRankingsForWeek(leagueId, week, result.rankings.map((r) => ({ teamId: r.teamId, rank: r.rank })));
      recordSent(leagueId, week, commissionerEmail, "recap");
      return res.json({ ok: true, message: "Weekly email sent to commissioner." });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to generate or send email." });
    }
  });

  app.get("/api/leagues/:leagueId/weekly-email/free-send-status", async (req: Request, res: Response) => {
    const leagueId = String(req.params.leagueId || "").trim();
    if (!leagueId) {
      return res.status(400).json({ error: "leagueId is required." });
    }
    return res.json(await getFreeSendStatus(leagueId));
  });

  // Weekly Commissioner Email — sent status (recap and preview separately)
  app.get("/api/leagues/:leagueId/weekly-email/sent", async (req: Request, res: Response) => {
    const leagueId = String(req.params.leagueId || "").trim();
    const week = Number(req.query.week) || 0;
    if (!leagueId || week < 1) {
      return res.status(400).json({ error: "leagueId and week are required." });
    }
    const status = getSentRecord(leagueId, week);
    return res.json({
      recap: status.recap ? { sent: true, sentAt: status.recap.sentAt } : { sent: false },
      preview: status.preview ? { sent: true, sentAt: status.preview.sentAt } : { sent: false },
    });
  });

  // Weekly Commissioner Email (power rankings + HTML email) — GET (legacy). Query: mode=preview|recap (default recap).
  app.get("/api/weekly-email", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    const week = Number(req.query.week) || 6;
    const format = String(req.query.format || "json").toLowerCase(); // "json" | "html"
    const mode = req.query.mode === "preview" ? "preview" : "recap";
    if (!league_id) {
      return res.status(400).json({ error: "league_id is required" });
    }
    try {
      const appOrigin = publicAppUrl(req);
      let leagueName: string;
      let emailHtml: string;
      let rankings: unknown[] = [];
      let subject: string;
      if (mode === "preview") {
        if (league_id === STATIC_DEMO_LEAGUE_ID) {
          const demoPayload = getDemoWeeklyPreviewPayload(week);
          leagueName = demoPayload.leagueName;
          emailHtml = generateWeeklyEmail({ ...demoPayload, appUrl: appOrigin });
          subject = `${leagueName} — Week ${week} Matchup Preview`;
        } else {
          if (week < 1) return res.status(400).json({ error: "week (>= 1) is required" });
          const result = await getWeeklyPreviewEmail(league_id, week, undefined, undefined, appOrigin);
          leagueName = result.leagueName;
          emailHtml = result.emailHtml;
          subject = `${leagueName} — Week ${week} Matchup Preview`;
        }
      } else {
        if (league_id === STATIC_DEMO_LEAGUE_ID) {
          const demoPayload = getDemoWeeklyEmailPayload(week);
          leagueName = demoPayload.leagueName;
          emailHtml = generateWeeklyEmail({ ...demoPayload, appUrl: appOrigin });
          rankings = demoPayload.rankings;
          subject = `${leagueName} — Week ${week} Power Rankings`;
        } else {
          if (week < 1) return res.status(400).json({ error: "week (>= 1) is required" });
          const previousRankings = getStoredPreviousRankings(league_id, week);
          const result = await getWeeklyCommissionerEmail(league_id, week, previousRankings, undefined, undefined, appOrigin, WEEKLY_EMAIL_V2_ENABLED);
          leagueName = result.leagueName;
          emailHtml = result.emailHtml;
          rankings = result.rankings;
          subject = getRecapSubject(leagueName, week, result.emailPayload);
        }
      }
      if (format === "html") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(emailHtml);
      }
      return res.json({
        leagueName,
        week,
        rankings,
        html: emailHtml,
        subject,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to generate weekly email" });
    }
  });

  // League History (Dominance Grid) - GET (Safari-friendly)
  app.get("/api/league-history/dominance", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    const start_week =
      req.query.start_week !== undefined ? Number(req.query.start_week) : 1;
    const end_week =
      req.query.end_week !== undefined ? Number(req.query.end_week) : 17;
    // Parse include_playoffs: "true" or "1" means true, default is false
    const include_playoffs = 
      req.query.include_playoffs === "true" || req.query.include_playoffs === "1";

    if (!league_id) return res.status(400).json({ error: "league_id is required" });

    try {
      const payload = await handleLeagueHistoryDominance({ 
        league_id, 
        start_week, 
        end_week,
        include_playoffs,
      });

      trackEvent("league_history_dominance", "/api/league-history/dominance", "GET", {
        start_week,
        end_week,
        include_playoffs,
      });

      // payload.cells already has correct DTO shape: { a, b, aName, bName, games, score, badge, record, pf, pa }
      // Server builds cells from grid.flatMap covering all A→B relationships
      return res.json({
        league: payload.league,
        grid: payload.grid,
        cells: payload.cells,
        totalsByManager: payload.totalsByManager,
        seasonStats: payload.seasonStats,
        weeklyMatchups: payload.weeklyMatchups,
        // Metadata for playoff filtering
        defaultRegularSeasonEnd: payload.defaultRegularSeasonEnd,
        playoffStartBySeason: payload.playoffStartBySeason,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Failed to build dominance grid" });
    }
  });
  
  // Roast (GET)
  app.get("/api/roast", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "");
    const week = Number(req.query.week || 0);
    const roster_id =
      req.query.roster_id !== undefined && req.query.roster_id !== ""
        ? Number(req.query.roster_id)
        : undefined;

    const parsed = roastRequestSchema.safeParse({ league_id, week, roster_id });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid query params", issues: parsed.error.issues });
    }

    // Demo league intercept - return static fictional data (no Sleeper API call)
    if (league_id === STATIC_DEMO_LEAGUE_ID) {
      return res.json(getDemoWeeklyRoast({ week, roster_id }));
    }

    try {
      const payload = await handleRoastWithFallback(parsed.data);
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch roast" });
    }
  });

  // Roast (POST)
  app.post("/api/roast", async (req: Request, res: Response) => {
    const parsed = roastRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
    }

    // Demo league intercept - return static fictional data (no Sleeper API call)
    if (parsed.data.league_id === STATIC_DEMO_LEAGUE_ID) {
      trackEvent("nfl_roast_demo", "/api/roast", "POST", { week: parsed.data.week });
      return res.json(getDemoWeeklyRoast({ week: parsed.data.week, roster_id: parsed.data.roster_id }));
    }

    try {
      const payload = await handleRoastWithFallback(parsed.data);
      trackEvent("nfl_roast", "/api/roast", "POST", { week: parsed.data.week });
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch roast" });
    }
  });

  // Wrapped (GET)
  app.get("/api/wrapped", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "");
    const week = Number(req.query.week || 0); // accepted by schema
    const roster_id =
      req.query.roster_id !== undefined && req.query.roster_id !== ""
        ? Number(req.query.roster_id)
        : undefined;

    const parsed = roastRequestSchema.safeParse({ league_id, week, roster_id });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid query params", issues: parsed.error.issues });
    }

    // Demo league intercept - return static fictional data (no Sleeper API call)
    if (league_id === STATIC_DEMO_LEAGUE_ID) {
      return res.json(getDemoWrapped({ roster_id }));
    }

    try {
      const payload = await handleWrapped(parsed.data);
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch wrapped" });
    }
  });

  // Wrapped (POST)
  app.post("/api/wrapped", async (req: Request, res: Response) => {
    const parsed = roastRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
    }

    // Demo league intercept - return static fictional data (no Sleeper API call)
    if (parsed.data.league_id === STATIC_DEMO_LEAGUE_ID) {
      trackEvent("season_wrapped_demo", "/api/wrapped", "POST");
      return res.json(getDemoWrapped({ roster_id: parsed.data.roster_id }));
    }

    try {
      const payload = await handleWrapped(parsed.data);
      trackEvent("season_wrapped", "/api/wrapped", "POST");
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch wrapped" });
    }
  });

  // League Autopsy (POST) - season-wide league stats
  app.post("/api/league-autopsy", async (req: Request, res: Response) => {
    const parsed = leagueAutopsyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
    }

    // Demo league intercept - return static fictional data (no Sleeper API call)
    if (parsed.data.league_id === STATIC_DEMO_LEAGUE_ID) {
      trackEvent("league_autopsy_demo", "/api/league-autopsy", "POST");
      return res.json(getDemoAutopsy());
    }

    try {
      const payload = await handleLeagueAutopsy(parsed.data);
      trackEvent("league_autopsy", "/api/league-autopsy", "POST");
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch league autopsy" });
    }
  });

  // -------------------------
  // FPL (Fantasy Premier League) Routes
  // -------------------------
  app.get("/api/fpl/current-gameweek", async (_req: Request, res: Response) => {
    try {
      const gameweek = await getCurrentGameweek();
      return res.json({ gameweek });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to fetch current gameweek" });
    }
  });

  app.post("/api/fpl/roast", async (req: Request, res: Response) => {
    const parsed = fplRoastRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      const payload = await handleFplRoast(parsed.data);
      trackEvent("fpl_roast", "/api/fpl/roast", "POST", { gameweek: parsed.data.eventId });
      return res.json(payload);
    } catch (err: any) {
      const message = err?.message || "Failed to fetch FPL roast";

      if (message === "Manager ID not found.") {
        return res.status(404).json({ error: message });
      }
      if (message.includes("gameweek isn't available")) {
        return res.status(400).json({ error: message });
      }

      return res.status(500).json({ error: message });
    }
  });

  // -------------------------
  // Client-side Analytics Tracking
  // -------------------------
  app.post("/api/track", async (req: Request, res: Response) => {
    try {
      const { event, properties } = req.body;
      if (!event || typeof event !== "string") {
        return res.status(400).json({ error: "Missing event name" });
      }
      // Pass request context (user_agent, ip_hash) for analytics
      trackEvent(event, "/api/track", "POST", properties || {}, getRequestContext(req));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[/api/track] Error:", err);
      return res.status(200).json({ ok: true }); // Never break client
    }
  });

  // -------------------------
  // Comp Code Unlock (Friend Trial)
  // -------------------------
  const ENABLE_COMP_CODES = process.env.ENABLE_COMP_CODES === "true";
  const COMP_CODES = process.env.COMP_CODES || "";

  // Simple in-memory rate limiter: IP -> { attempts, resetAt }
  const compCodeAttempts = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  function parseCompCodes(): Map<string, string> {
    // Format: "leagueId1:CODE1,leagueId2:CODE2"
    const map = new Map<string, string>();
    if (!COMP_CODES.trim()) return map;
    for (const entry of COMP_CODES.split(",")) {
      const [leagueId, code] = entry.split(":");
      if (leagueId && code) {
        map.set(leagueId.trim(), code.trim());
      }
    }
    return map;
  }

  app.post("/api/comp/unlock", (req: Request, res: Response) => {
    // Production safety: disabled unless explicitly enabled
    if (!ENABLE_COMP_CODES) {
      return res.status(404).json({ error: "Not found" });
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // Rate limiting
    const record = compCodeAttempts.get(ip);
    if (record) {
      if (now < record.resetAt) {
        if (record.count >= RATE_LIMIT_MAX) {
          return res.status(429).json({ error: "Too many attempts. Try again later." });
        }
        record.count++;
      } else {
        compCodeAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      }
    } else {
      compCodeAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    const { league_id, code } = req.body || {};
    if (!league_id || !code) {
      return res.status(400).json({ error: "Invalid code" });
    }

    const codeMap = parseCompCodes();
    const expectedCode = codeMap.get(String(league_id).trim());

    if (!expectedCode || expectedCode !== String(code).trim()) {
      trackEvent("comp_code_failed", "/api/comp/unlock", "POST", { league_id });
      return res.status(400).json({ error: "Invalid code" });
    }

    // Success
    const unlockedId = String(league_id).trim();
    unlockedLeagueIds.add(unlockedId);
    void markLeagueUnlocked(unlockedId).catch((err) => {
      console.error("[unlock-store] failed to persist comp unlock:", err);
    });
    trackEvent("comp_code_success", "/api/comp/unlock", "POST", { league_id });
    return res.json({ ok: true });
  });

  // -------------------------
  // Stripe Checkout (MVP)
  // -------------------------
  app.post("/api/checkout/create-session", async (req: Request, res: Response) => {
    try {
      const league_id = String(req.body?.league_id || "").trim();
      if (!league_id) {
        return res.status(400).json({ error: "league_id is required" });
      }
      if (!stripe || !STRIPE_PRICE_ID) {
        return res.status(500).json({ error: "Stripe is not configured" });
      }

      const success_url = `${CLIENT_URL}/league-history/dominance?league_id=${encodeURIComponent(
        league_id
      )}&success=true`;
      const cancel_url = `${CLIENT_URL}/league-history/dominance?league_id=${encodeURIComponent(
        league_id
      )}&canceled=true`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url,
        cancel_url,
        metadata: {
          league_id,
        },
      });

      if (!session.url) {
        return res.status(500).json({ error: "Failed to create checkout session" });
      }

      // Track checkout session creation
      trackEvent("checkout_session_created", "/api/checkout/create-session", "POST", {
        league_id,
        session_id: session.id,
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error("[/api/checkout/create-session] Error:", err);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // -------------------------
  // Stripe Webhook (checkout.session.completed)
  // This is the ONLY reliable way to track completed purchases
  // -------------------------
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const sig = req.headers["stripe-signature"] as string | undefined;
    
    // If no webhook secret configured, log warning but still process (for testing)
    if (!STRIPE_WEBHOOK_SECRET) {
      console.warn("[Stripe Webhook] No STRIPE_WEBHOOK_SECRET configured - skipping signature verification");
    }

    let event: Stripe.Event;
    try {
      if (STRIPE_WEBHOOK_SECRET && sig) {
        // Verify webhook signature using raw body
        const rawBody = req.rawBody as Buffer;
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
      } else {
        // Fallback for testing without signature (NOT recommended for production)
        event = req.body as Stripe.Event;
      }
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const leagueId = session.metadata?.league_id || null;
      const amountTotal = session.amount_total; // in cents
      const currency = session.currency;
      const customerEmail = session.customer_details?.email || null;

      console.log(`[Stripe Webhook] checkout.session.completed: session=${sessionId}, league=${leagueId}, amount=${amountTotal} ${currency}`);
      if (leagueId) {
        const unlockedId = String(leagueId).trim();
        unlockedLeagueIds.add(unlockedId);
        void markLeagueUnlocked(unlockedId).catch((err) => {
          console.error("[unlock-store] failed to persist webhook unlock:", err);
        });
      }

      // Track the webhook-confirmed purchase (this is the source of truth)
      trackEvent("purchase_completed_webhook", "/api/stripe/webhook", "POST", {
        session_id: sessionId,
        league_id: leagueId,
        amount_cents: amountTotal,
        currency,
        // Don't log email for privacy, but note if present
        has_email: !!customerEmail,
      });
    }

    // Acknowledge receipt
    return res.json({ received: true });
  });

  // -------------------------
  // Analytics Stats Endpoint (protected by ADMIN_KEY)
  // -------------------------
  app.get("/api/stats", async (req: Request, res: Response) => {
    const key = req.query.key as string | undefined;
    if (!ADMIN_KEY || key !== ADMIN_KEY) {
      return res.status(401).json({ error: "Unauthorized. Provide ?key=ADMIN_KEY" });
    }

    try {
      const uptimeMs = Date.now() - serverStartedAt;
      const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
      const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

      const [totals, recentEvents, firstStartedAt, usingDb] = await Promise.all([
        getTotals(),
        getRecentEvents(50),
        getFirstStartedAt(),
        isUsingDatabase(),
      ]);

      return res.json({
        uptimeMs,
        uptime: `${uptimeHours}h ${uptimeMinutes}m`,
        serverStartedAt: new Date(serverStartedAt).toISOString(),
        firstStartedAt: new Date(firstStartedAt).toISOString(),
        totals,
        recentEvents,
        storageType: usingDb ? "postgresql" : "in-memory",
      });
    } catch (err: any) {
      console.error("[/api/stats] Error:", err);
      return res.status(500).json({ error: "Failed to retrieve stats" });
    }
  });

  // -------------------------
  // Analytics Summary Endpoint (protected by ADMIN_KEY)
  // Returns: 24h/7d event counts, unique leagues, conversion funnel
  // -------------------------
  app.get("/api/admin/analytics/summary", async (req: Request, res: Response) => {
    const key = req.query.key as string | undefined;
    if (!ADMIN_KEY || key !== ADMIN_KEY) {
      return res.status(401).json({ error: "Unauthorized. Provide ?key=ADMIN_KEY" });
    }

    try {
      const summary = await getAnalyticsSummary();
      
      // Calculate conversion rates using webhook-confirmed purchases (source of truth)
      const webhookPurchases = summary.funnel.purchase_completed_webhook;
      const checkoutSessions = summary.funnel.checkout_session_created;
      const unlockClicks = summary.funnel.unlock_clicked;
      
      const conversionRates = {
        unlock_to_checkout: unlockClicks > 0 
          ? ((checkoutSessions / unlockClicks) * 100).toFixed(1) + "%"
          : "N/A",
        // Webhook-confirmed completion rate (most reliable)
        checkout_completion_rate: checkoutSessions > 0
          ? ((webhookPurchases / checkoutSessions) * 100).toFixed(1) + "%"
          : "N/A",
        // Overall funnel conversion
        overall: unlockClicks > 0
          ? ((webhookPurchases / unlockClicks) * 100).toFixed(1) + "%"
          : "N/A",
        // Client-side success (for comparison - may miss some)
        checkout_to_client_success: checkoutSessions > 0
          ? ((summary.funnel.purchase_success / checkoutSessions) * 100).toFixed(1) + "%"
          : "N/A",
      };
      
      return res.json({
        generated_at: new Date().toISOString(),
        ...summary,
        conversion_rates: conversionRates,
      });
    } catch (err: any) {
      console.error("[/api/admin/analytics/summary] Error:", err);
      return res.status(500).json({ error: "Failed to retrieve analytics summary" });
    }
  });

  return httpServer;
}
