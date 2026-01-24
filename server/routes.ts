// server/routes.ts
import type { Express, Request, Response } from "express";
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
} from "./analytics-db";

// ✅ NEW: League History (Dominance Grid)
import { handleLeagueHistoryDominance } from "./league-history";

// -------------------------
// Analytics (PostgreSQL-backed with in-memory fallback)
// -------------------------
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const serverStartedAt = Date.now();

// Initialize DB on startup (async, runs in background)
ensureDb().catch((err) => console.error("[Analytics] DB init error:", err));

function trackEvent(type: string, route: string, method: string, meta?: Record<string, any>) {
  recordEvent(type, route, method, Date.now(), meta || {}).catch((err) =>
    console.error("[Analytics] recordEvent error:", err),
  );
  console.log(`[Analytics] ${type} ${method} ${route}`, meta || "");
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
// Player name lookup (small + cached)
// -------------------------
const playerNameCache = new Map<string, string>();

async function getPlayerName(player_id: string): Promise<string> {
  if (!player_id) return "Unknown Player";
  const cached = playerNameCache.get(player_id);
  if (cached) return cached;

  try {
    const p = await fetchJson<SleeperPlayer>(`https://api.sleeper.app/v1/player/${player_id}`);
    const name =
      p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || `Player ${player_id}`;
    const decorated = p.position && p.team ? `${name} (${p.position}, ${p.team})` : name;
    playerNameCache.set(player_id, decorated);
    return decorated;
  } catch {
    const fallback = `Player ${player_id}`;
    playerNameCache.set(player_id, fallback);
    return fallback;
  }
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
// Weekly: compute Biggest Blowout (league-wide)
// -------------------------
function computeBiggestBlowout(matchups: SleeperMatchup[], rosterName: (rid: number) => string) {
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
    byMatchup.get(m.matchup_id)!.push(m);
  }

  let best: { winner: SleeperMatchup; loser: SleeperMatchup; margin: number } | null = null;

  for (const [, rows] of Array.from(byMatchup.entries())) {
    if (rows.length < 2) continue;
    const a = rows[0]!;
    const b = rows[1]!;
    const aPts = safeNumber(a.points);
    const bPts = safeNumber(b.points);
    const winner = aPts >= bPts ? a : b;
    const loser = aPts >= bPts ? b : a;
    const margin = Math.abs(aPts - bPts);

    if (!best || margin > best.margin) best = { winner, loser, margin };
  }

  if (!best) return null;

  const winnerName = rosterName(best.winner.roster_id);
  const loserName = rosterName(best.loser.roster_id);

  return {
    type: "biggest_blowout",
    title: "Biggest Blowout",
    subtitle: `${winnerName} put ${loserName} in a body bag.`,
    stat: `+${formatPts(best.margin)} pts`,
    meta: {
      winner_roster_id: best.winner.roster_id,
      loser_roster_id: best.loser.roster_id,
      winner_score: safeNumber(best.winner.points),
      loser_score: safeNumber(best.loser.points),
      margin: best.margin,
    },
  };
}

// -------------------------
// Weekly: compute Carry Job (league-wide)
// -------------------------
async function computeCarryJob(matchups: SleeperMatchup[], rosterName: (rid: number) => string) {
  let best:
    | { roster_id: number; roster_points: number; player_id: string; player_points: number; ratio: number }
    | null = null;

  for (const row of matchups) {
    const rosterPts = safeNumber(row.points);
    const pp = row.players_points || row.starters_points || {};
    const entries = Object.entries(pp);

    if (!entries.length || rosterPts <= 0) continue;

    let topPlayerId = "";
    let topPts = -Infinity;
    for (const [pid, ptsRaw] of entries) {
      const pts = safeNumber(ptsRaw);
      if (pts > topPts) {
        topPts = pts;
        topPlayerId = pid;
      }
    }

    if (!topPlayerId || topPts <= 0) continue;

    const ratio = topPts / rosterPts;
    if (!best || ratio > best.ratio) {
      best = {
        roster_id: row.roster_id,
        roster_points: rosterPts,
        player_id: topPlayerId,
        player_points: topPts,
        ratio,
      };
    }
  }

  if (!best) return null;

  const manager = rosterName(best.roster_id);
  const playerName = await getPlayerName(best.player_id);
  const share = pct(best.ratio);

  return {
    type: "carry_job",
    title: "Carry Job",
    subtitle: `${manager} was basically ${playerName} + vibes.`,
    stat: `${share} of team points`,
    meta: {
      roster_id: best.roster_id,
      roster_points: best.roster_points,
      player_id: best.player_id,
      player_name: playerName,
      player_points: best.player_points,
      ratio: best.ratio,
    },
  };
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

  // roster scores
  const scoreByRoster = new Map<number, number>();
  for (const m of matchups) scoreByRoster.set(m.roster_id, safeNumber(m.points));

  const entries = Array.from(scoreByRoster.entries()).map(([rid, score]) => ({
    roster_id: rid,
    username: rosterName(rid),
    score,
  }));

  const total = entries.reduce((acc, e) => acc + e.score, 0);
  const averageScore = entries.length ? total / entries.length : 0;

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const highestScorer = sorted[0] || { roster_id: 0, username: "—", score: 0 };
  const lowestScorer = sorted[sorted.length - 1] || { roster_id: 0, username: "—", score: 0 };

  // Roast copy (clean + spicy)
  const headline =
    highestScorer.roster_id === lowestScorer.roster_id
      ? `${highestScorer.username} somehow achieved the impossible: a perfectly average week.`
      : `${highestScorer.username} went nuclear. ${lowestScorer.username} went missing.`;

  // Cards (league-wide MVP)
  const blowout = computeBiggestBlowout(matchups, rosterName);
  const carry = await computeCarryJob(matchups, rosterName);

  const cards = [blowout, carry].filter(Boolean) as any[];

  const payload: RoastResponse = {
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
    },
    week,
    headline,
    stats: {
      averageScore,
      highestScorer,
      lowestScorer,
    },
    cards,
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

    if (margin > 0) {
      if (!bestWin || margin > bestWin.margin) {
        bestWin = { week: w, margin, oppRid: oppRow.roster_id, you, opp };
      }
    } else if (margin < 0) {
      if (!worstLoss || margin < worstLoss.margin) {
        worstLoss = { week: w, margin, oppRid: oppRow.roster_id, you, opp };
      }
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

  const cards = [
    {
      type: "season_summary",
      title: "Season Summary",
      subtitle: derivedRank ? `${displayName} finished #${derivedRank}` : `${displayName} season recap`,
      stat: `${record} record`,
    },
    {
      type: "season_mvp",
      title: "Team MVP",
      subtitle: mvpName === "No data" ? "Couldn’t read player points for this league." : mvpName,
      stat: `${mvpPoints.toFixed(1)} pts`,
    },
    {
      type: "best_win",
      title: "Biggest Win",
      subtitle: bestWin
        ? `Week ${bestWin.week}: you cooked ${rosterName(bestWin.oppRid)}.`
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
    {
      type: "worst_loss",
      title: "Worst Loss",
      subtitle: worstLoss
        ? `Week ${worstLoss.week}: ${rosterName(worstLoss.oppRid)} sent you to the shadow realm.`
        : "No losses found in this season range.",
      stat: worstLoss ? `-${formatPts(bestLossAbs(worstLoss.margin))} pts` : "—",
      meta: worstLoss
        ? {
            week: worstLoss.week,
            margin: Number(formatPts(bestLossAbs(worstLoss.margin))),
            opponent: rosterName(worstLoss.oppRid),
            you: Number(formatPts(worstLoss.you)),
            opp: Number(formatPts(worstLoss.opp)),
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
      tagline: "Someone had to finish here.",
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
      tagline: "This broke the league.",
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
      tagline: "Authorities were notified.",
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
      tagline: "This game was over at kickoff.",
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
    cards.push({
      type: "highest_loss",
      title: "FANTASY INJUSTICE",
      subtitle: `${teamName} (${formatPts(highestScoreInLoss.points)}) lost to ${oppName} (${formatPts(
        highestScoreInLoss.opp_points,
      )}) in Week ${highestScoreInLoss.week}`,
      tagline: "Did everything right. Still lost.",
      stat: formatPts(highestScoreInLoss.points),
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

    try {
      const payload = await handleLeagueTeams(league_id);
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch league teams" });
    }
  });

  // League History (Dominance Grid) - GET (Safari-friendly)
  app.get("/api/league-history/dominance", async (req: Request, res: Response) => {
    const league_id = String(req.query.league_id || "").trim();
    const start_week =
      req.query.start_week !== undefined ? Number(req.query.start_week) : 1;
    const end_week =
      req.query.end_week !== undefined ? Number(req.query.end_week) : 17;

    if (!league_id) return res.status(400).json({ error: "league_id is required" });

    try {
      const payload = await handleLeagueHistoryDominance({ league_id, start_week, end_week });

      trackEvent("league_history_dominance", "/api/league-history/dominance", "GET", {
        start_week,
        end_week,
      });

      // payload.cells already has correct DTO shape: { a, b, aName, bName, games, score, badge, record, pf, pa }
      // Server builds cells from grid.flatMap covering all A→B relationships
      return res.json({
        league: payload.league,
        grid: payload.grid,
        cells: payload.cells,
        totalsByManager: payload.totalsByManager,
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

  return httpServer;
}
