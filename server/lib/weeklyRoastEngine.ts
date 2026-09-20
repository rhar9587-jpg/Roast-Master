/**
 * Weekly Roast — league-level narrative engine (single source for tab + email).
 * Real Sleeper matchup data only; short punchy copy.
 */

import { fetchJson } from "../league-history/sleeper";
import type { SleeperMatchup } from "../league-history/sleeper";
import type { Card } from "@shared/schema";
import { classifyWeekMatchupPairs } from "./domain/classifyWeekMatchups";
import { scoresFromPlayedClassification } from "./domain/matchupStatus";
import {
  pickClosestFinalGame,
  pickFraudWatchPair,
  pickLargestMarginWinner,
} from "./domain/matchupOutcomes";
import { findBestSitStartMiss } from "./sitStartMiss";
import {
  UNKNOWN_PLAYER_DISPLAY,
  displayNameFromSleeperPlayer,
  looksLikeRawPlayerIdFallback,
  resolvePlayerDisplayName,
} from "./playerDisplayName";

// Re-export shared helpers so existing tests/imports keep working.
export {
  UNKNOWN_PLAYER_DISPLAY,
  displayNameFromSleeperPlayer,
  looksLikeRawPlayerIdFallback,
  resolvePlayerDisplayName,
};

type LeagueRef = { league_id: string; name: string; season?: string };

export type WeeklyRoastSignals = {
  medianScore: number;
  closestMargin: number | null;
  closestGame?: { teamA: string; teamB: string; scoreA: number; scoreB: number };
  blowoutMargin: number | null;
  highestScore: number;
  lowestScore: number;
};

export type WeeklyRoastNarrative = {
  headline: string;
  stats: {
    averageScore: number;
    highestScorer: { roster_id: number; username: string; score: number };
    lowestScorer: { roster_id: number; username: string; score: number };
  };
  cards: Card[];
  groupChatSummary: string;
  signals: WeeklyRoastSignals;
};

function safeNumber(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function formatPts(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

type SleeperPlayer = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
};

const playerNameCache = new Map<string, string>();

/** Test helper — clears the in-memory player display cache. */
export function clearPlayerNameCacheForTests() {
  playerNameCache.clear();
}

async function getPlayerName(player_id: string): Promise<string> {
  if (!player_id) return UNKNOWN_PLAYER_DISPLAY;

  const cached = playerNameCache.get(player_id);
  if (cached) {
    // Defend against any historically poisoned raw-ID cache entries.
    if (!looksLikeRawPlayerIdFallback(cached)) return cached;
    playerNameCache.delete(player_id);
  }

  // 1) Prefer the cached full NFL players map (same source used by sit/start).
  try {
    const map = await getNflPlayers();
    const fromMap = displayNameFromSleeperPlayer(map[player_id], {
      decoratePositionTeam: true,
    });
    if (fromMap) {
      playerNameCache.set(player_id, fromMap);
      return fromMap;
    }
  } catch {
    // Fall through to individual lookup.
  }

  // 2) Individual Sleeper player endpoint as secondary fallback.
  try {
    const p = await fetchJson<SleeperPlayer>(`https://api.sleeper.app/v1/player/${player_id}`);
    const fromIndividual = displayNameFromSleeperPlayer(p, {
      decoratePositionTeam: true,
    });
    if (fromIndividual) {
      playerNameCache.set(player_id, fromIndividual);
      return fromIndividual;
    }
  } catch {
    // Fall through to neutral unknown.
  }

  // 3) Never cache a raw-ID fallback — failed lookups must not poison the cache.
  return UNKNOWN_PLAYER_DISPLAY;
}

let nflPlayersCache: Record<string, SleeperPlayer> | null = null;
let nflPlayersCacheTs = 0;

async function getNflPlayers(): Promise<Record<string, SleeperPlayer>> {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (nflPlayersCache && now - nflPlayersCacheTs < ONE_DAY) return nflPlayersCache;
  const players = await fetchJson<Record<string, SleeperPlayer>>(
    "https://api.sleeper.app/v1/players/nfl",
    30000,
  );
  nflPlayersCache = players;
  nflPlayersCacheTs = now;
  return players;
}

function computeBiggestBlowout(
  matchups: SleeperMatchup[],
  rosterName: (rid: number) => string,
  weekIsFinal = true,
) {
  const best = pickLargestMarginWinner(matchups, { weekIsFinal });
  if (!best) return null;

  const winnerName = rosterName(best.winnerRosterId);
  const loserName = rosterName(best.loserRosterId);

  return {
    type: "biggest_embarrassment",
    title: "Biggest Embarrassment",
    subtitle: `${winnerName} dropped ${loserName} by ${formatPts(best.margin)}.`,
    stat: `+${formatPts(best.margin)} pts`,
    tagline: "Not competitive.",
    meta: {
      winner_roster_id: best.winnerRosterId,
      loser_roster_id: best.loserRosterId,
      winner_name: winnerName,
      loser_name: loserName,
      winner_score: best.winnerPoints,
      loser_score: best.loserPoints,
      margin: best.margin,
    },
  };
}

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
    tagline: "One player, most of the points.",
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

function computeClosestGame(
  matchups: SleeperMatchup[],
  weekIsFinal = true,
): { margin: number; rosterIdA: number; pointsA: number; rosterIdB: number; pointsB: number } | null {
  return pickClosestFinalGame(matchups, { weekIsFinal });
}

/** Win with a weak score vs league, or loss with a strong score — completed games only. */
function computeFraudWatch(
  matchups: SleeperMatchup[],
  rosterName: (rid: number) => string,
  medianScore: number,
  weekIsFinal = true,
): Card | null {
  const best = pickFraudWatchPair(matchups, medianScore, { weekIsFinal });
  if (!best) return null;

  const wName = rosterName(best.winnerRosterId);
  const lName = rosterName(best.loserRosterId);
  if (best.kind === "lucky_win") {
    return {
      type: "fraud_watch",
      title: "Fraud Watch",
      subtitle: `${wName} won at ${formatPts(best.winnerPoints)}; league median was ${formatPts(medianScore)}.`,
      stat: "Won light",
      tagline: `${lName} couldn't cash in anyway.`,
      meta: {
        kind: best.kind,
        medianScore,
        manager_name: wName,
        score: best.winnerPoints,
      },
    };
  }
  return {
    type: "fraud_watch",
    title: "Fraud Watch",
    subtitle: `${lName} put up ${formatPts(best.loserPoints)} and still lost to ${wName}.`,
    stat: "Robbed",
    tagline: "Good week, bad result.",
    meta: {
      kind: best.kind,
      medianScore,
      manager_name: lName,
      score: best.loserPoints,
    },
  };
}

/** Bench points left — aligned with weeklyCommissioner worstCoach heuristic. */
async function computeWorstCoaching(
  matchups: SleeperMatchup[],
  rosterName: (rid: number) => string,
): Promise<Card | null> {
  let playersById: Record<string, SleeperPlayer>;
  try {
    playersById = await getNflPlayers();
  } catch {
    return null;
  }

  type Worst = { roster_id: number; benchPoints: number; sitStartMiss?: string };
  let worst: Worst | undefined;

  for (const row of matchups) {
    if (!row.players?.length) continue;
    const pts = row.players_points || row.starters_points || {};
    const starters = new Set(row.starters || []);
    const benchPoints = row.players
      .filter((pid) => !starters.has(pid))
      .reduce((sum, pid) => sum + Math.max(0, safeNumber(pts[pid])), 0);
    if (!Number.isFinite(benchPoints) || benchPoints <= 0) continue;
    if (!worst || benchPoints > worst.benchPoints) {
      const miss = findBestSitStartMiss(row, playersById);
      worst = {
        roster_id: row.roster_id,
        benchPoints,
        ...(miss ? { sitStartMiss: miss.sitStartMiss } : {}),
      };
    }
  }

  if (!worst) return null;
  const team = rosterName(worst.roster_id);
  return {
    type: "worst_coaching",
    title: "Most Points Left on Bench",
    subtitle: worst.sitStartMiss ?? `${team} left ${formatPts(worst.benchPoints)} pts on the bench.`,
    stat: `${formatPts(worst.benchPoints)} bench pts`,
    tagline: "Bench points, not a full coaching grade.",
    meta: {
      roster_id: worst.roster_id,
      team_name: team,
      benchPoints: worst.benchPoints,
    },
  };
}

function buildHeadline(params: {
  week: number;
  highestName: string;
  lowestName: string;
  sameTeam: boolean;
  closest: { margin: number; rosterIdA: number; rosterIdB: number } | null;
  rosterName: (rid: number) => string;
}): string {
  const { week, highestName, lowestName, sameTeam, closest, rosterName } = params;
  const mod = week % 3;
  let base: string;
  if (sameTeam) {
    base = `${highestName} had the only score that mattered — everyone else tied for irrelevant.`;
  } else if (mod === 0) {
    base = `Week ${week}: ${highestName} ran the slate. ${lowestName} filed a missing score report.`;
  } else if (mod === 1) {
    base = `${highestName} feasted. ${lowestName} forgot to set a lineup (emotionally, at least).`;
  } else {
    base = `The box scores don't lie: ${highestName} dealt, ${lowestName} folded.`;
  }

  if (closest && closest.margin <= 5 && closest.margin >= 0) {
    const n1 = rosterName(closest.rosterIdA);
    const n2 = rosterName(closest.rosterIdB);
    base += ` ${n1} vs ${n2} was a ${formatPts(closest.margin)}-pt nail-biter.`;
  }
  return base;
}

function buildGroupChatSummary(params: {
  week: number;
  leagueName: string;
  highestName: string;
  highScore: number;
  lowestName: string;
  lowScore: number;
  blowout: ReturnType<typeof computeBiggestBlowout>;
  fraud: Card | null;
  worst: Card | null;
}): string {
  const { week, leagueName, highestName, highScore, lowestName, lowScore, blowout, fraud, worst } = params;
  const parts: string[] = [];
  parts.push(
    `${leagueName} — Week ${week}: ${highestName} led the week at ${formatPts(highScore)} pts; ${lowestName} bottomed at ${formatPts(lowScore)}.`,
  );
  if (blowout?.subtitle) parts.push(blowout.subtitle);
  if (fraud?.subtitle) parts.push(fraud.subtitle);
  if (worst?.subtitle) parts.push(worst.subtitle);
  return parts.join(" ");
}

export async function buildWeeklyRoastNarrative(params: {
  league: LeagueRef;
  week: number;
  matchups: SleeperMatchup[];
  rosterName: (rid: number) => string;
  /** When false, winner-dependent cards (blowout / fraud / closest final) are skipped. */
  weekIsFinal?: boolean;
}): Promise<WeeklyRoastNarrative> {
  const { league, week, matchups, rosterName } = params;
  const weekIsFinal = params.weekIsFinal !== false;
  if (!matchups?.length) {
    throw new Error(`No matchup data found for week ${week}.`);
  }

  // High / low / median: final weeks use played classifications only (exclude 0–0 shells).
  // Non-final weeks may surface live scores without inventing winners.
  const scoreByRoster = new Map<number, number>();
  if (weekIsFinal) {
    const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal: true });
    for (const pair of pairs) {
      const scores = scoresFromPlayedClassification(pair.classification);
      if (!scores.length) continue;
      for (const row of pair.rows) {
        scoreByRoster.set(row.roster_id, safeNumber(row.points));
      }
    }
  } else {
    for (const m of matchups) scoreByRoster.set(m.roster_id, safeNumber(m.points));
  }

  // Fallback if classification yields nothing (e.g. all scheduled): use raw scores for display.
  if (scoreByRoster.size === 0) {
    for (const m of matchups) scoreByRoster.set(m.roster_id, safeNumber(m.points));
  }

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

  const scores = sorted.map((e) => e.score).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  const medianScore =
    scores.length % 2 === 1 ? scores[mid]! : (scores[mid - 1]! + scores[mid]!) / 2;

  const closest = computeClosestGame(matchups, weekIsFinal);
  const blowout = computeBiggestBlowout(matchups, rosterName, weekIsFinal);
  const fraud = computeFraudWatch(matchups, rosterName, medianScore, weekIsFinal);
  const [carry, worstCoach] = await Promise.all([
    computeCarryJob(matchups, rosterName),
    computeWorstCoaching(matchups, rosterName),
  ]);

  const headline = buildHeadline({
    week,
    highestName: highestScorer.username,
    lowestName: lowestScorer.username,
    sameTeam: highestScorer.roster_id === lowestScorer.roster_id && highestScorer.roster_id !== 0,
    closest,
    rosterName,
  });

  const groupChatSummary = buildGroupChatSummary({
    week,
    leagueName: league.name,
    highestName: highestScorer.username,
    highScore: highestScorer.score,
    lowestName: lowestScorer.username,
    lowScore: lowestScorer.score,
    blowout,
    fraud,
    worst: worstCoach,
  });

  const topDogCard: Card = {
    type: "top_dog",
    title: "Top Dog",
    subtitle: `${highestScorer.username} paced the league this week.`,
    stat: `${formatPts(highestScorer.score)} pts`,
    tagline: "Highest score on the board.",
    meta: { roster_id: highestScorer.roster_id },
  };

  const groupChatCard: Card = {
    type: "group_chat_drop",
    title: "Group Chat Drop",
    subtitle: groupChatSummary.slice(0, 280) + (groupChatSummary.length > 280 ? "…" : ""),
    tagline: "Copy, paste, send.",
    stat: "League recap",
  };

  const cards: Card[] = [
    topDogCard,
    ...(blowout ? [blowout] : []),
    ...(fraud ? [fraud] : []),
    ...(worstCoach ? [worstCoach] : []),
    ...(carry ? [carry] : []),
    groupChatCard,
  ];

  const signals: WeeklyRoastSignals = {
    medianScore,
    closestMargin: closest ? closest.margin : null,
    closestGame: closest
      ? {
          teamA: rosterName(closest.rosterIdA),
          teamB: rosterName(closest.rosterIdB),
          scoreA: closest.pointsA,
          scoreB: closest.pointsB,
        }
      : undefined,
    blowoutMargin: blowout?.meta && typeof blowout.meta === "object" && "margin" in blowout.meta
      ? Number((blowout.meta as { margin: number }).margin)
      : null,
    highestScore: highestScorer.score,
    lowestScore: lowestScorer.score,
  };

  return {
    headline,
    stats: {
      averageScore,
      highestScorer,
      lowestScorer,
    },
    cards,
    groupChatSummary,
    signals,
  };
}
