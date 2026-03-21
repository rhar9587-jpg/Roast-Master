/**
 * Fantasy Roast — Weekly Commissioner integration
 * Builds power-ranking teams from Sleeper, runs engine, derives villain/fraud/intro for email.
 */

import { getLeague, getRosters, getUsers, getMatchups } from "../league-history/sleeper";
import type { SleeperMatchup } from "../league-history/sleeper";
import type { PowerRankingsTeamInput, PowerRankingRow } from "./powerRankings";
import { generatePowerRankings } from "./powerRankings";
import { generateWeeklyEmail, generateWeeklyEmailPlainText, type WeeklyEmailData, type WeeklyEmailRankingRow } from "./weeklyEmail";
import { getLeagueHistoryNarratives } from "./weeklyEmailNarratives";
import { buildWeeklyRoastNarrative } from "./weeklyRoastEngine";

// Sleeper API returns roster settings with fpts/fpts_decimal; type is extended here for the adapter
interface RosterWithPoints {
  roster_id: number;
  owner_id: string | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    rank?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  };
}

type SleeperPlayerLite = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
};

let nflPlayersCache: Record<string, SleeperPlayerLite> | null = null;
let nflPlayersCacheTs = 0;
const POSITION_LEADERS_CACHE_TTL_MS = 10 * 60 * 1000;
const POSITION_LEADERS_MAX_MS = 3500;
const positionLeadersCache = new Map<string, { expiresAt: number; value?: WeeklyEmailData["positionLeaders"] }>();

async function getNflPlayers(): Promise<Record<string, SleeperPlayerLite>> {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (nflPlayersCache && now - nflPlayersCacheTs < ONE_DAY) return nflPlayersCache;
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper players API ${res.status}`);
  const players = (await res.json()) as Record<string, SleeperPlayerLite>;
  nflPlayersCache = players;
  nflPlayersCacheTs = now;
  return players;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function safeNum(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pointsFromRoster(r: RosterWithPoints): number {
  const base = r?.settings?.fpts ?? 0;
  const dec = r?.settings?.fpts_decimal ?? 0;
  return base + dec / 100;
}

function rosterDisplayName(
  rosterId: number,
  rosters: RosterWithPoints[],
  userById: Map<string, { user_id: string; username?: string; display_name?: string }>,
): string {
  const roster = rosters.find((r) => r.roster_id === rosterId);
  const owner = roster?.owner_id ? userById.get(roster.owner_id) : null;
  return owner?.display_name || owner?.username || `Team ${rosterId}`;
}

/**
 * Build teams array for power rankings from Sleeper league data (rosters + matchups 1..week).
 */
export async function buildTeamsFromSleeper(
  leagueId: string,
  throughWeek: number,
): Promise<{ leagueName: string; teams: PowerRankingsTeamInput[] }> {
  const [league, rostersRaw, users] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
  ]);

  const rosters = rostersRaw as RosterWithPoints[];
  const userById = new Map(users.map((u) => [u.user_id, u]));

  // Weekly scores per roster: roster_id -> number[] (weeks 1..throughWeek)
  const weeklyScoresByRoster = new Map<number, number[]>();

  for (let w = 1; w <= throughWeek; w++) {
    let matchups;
    try {
      matchups = await getMatchups(leagueId, w);
    } catch {
      continue;
    }
    if (!matchups?.length) continue;
    for (const m of matchups) {
      const pts = safeNum(m.points);
      const list = weeklyScoresByRoster.get(m.roster_id) ?? [];
      list.push(pts);
      weeklyScoresByRoster.set(m.roster_id, list);
    }
  }

  const teams: PowerRankingsTeamInput[] = rosters.map((r) => {
    const weeklyScores = weeklyScoresByRoster.get(r.roster_id) ?? [];
    const wins = r.settings?.wins ?? 0;
    const losses = r.settings?.losses ?? 0;
    const pointsFor =
      weeklyScores.length > 0
        ? weeklyScores.reduce((a, b) => a + b, 0)
        : pointsFromRoster(r);
    return {
      teamId: String(r.roster_id),
      teamName: rosterDisplayName(r.roster_id, rosters, userById),
      wins,
      losses,
      pointsFor,
      weeklyScores,
    };
  });

  return {
    leagueName: league.name || "Fantasy League",
    teams,
  };
}

/**
 * Pick villain of the week from matchup data: winner of the smallest-margin game.
 * Returns null if no valid matchups. Caller can fall back to luck-based pick.
 */
function pickVillainFromMatchups(
  matchups: SleeperMatchup[],
  rosterNameByTeamId: (teamId: string) => string,
): { teamName: string; reason: string } | null {
  if (!matchups?.length) return null;
  const byMatchup = new Map<number, { roster_id: number; points: number }[]>();
  for (const m of matchups) {
    if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
    byMatchup.get(m.matchup_id)!.push({ roster_id: m.roster_id, points: safeNum(m.points) });
  }
  let smallestMargin = Infinity;
  let villainRosterId: number | null = null;
  let smallestMarginVal = 0;
  for (const rows of Array.from(byMatchup.values())) {
    if (rows.length < 2) continue;
    const [a, b] = rows;
    const margin = Math.abs(a.points - b.points);
    const winner = a.points >= b.points ? a : b;
    if (margin < smallestMargin && margin >= 0) {
      smallestMargin = margin;
      villainRosterId = winner.roster_id;
      smallestMarginVal = margin;
    }
  }
  if (villainRosterId == null) return null;
  const teamName = rosterNameByTeamId(String(villainRosterId));
  const reason =
    smallestMarginVal < 1
      ? `Won by ${smallestMarginVal.toFixed(1)} points. That's not a win, that's a stat correction.`
      : `Won by ${smallestMarginVal.toFixed(1)} points. Someone's schedule is doing the heavy lifting.`;
  return { teamName, reason };
}

/**
 * Pick villain of the week: winner of the smallest-margin game. If matchups provided, use them; else fetch.
 * Fall back to highest luckDelta among winners when no matchup data.
 */
function pickVillain(
  leagueId: string,
  week: number,
  rankings: PowerRankingRow[],
  rosterNameByTeamId: (teamId: string) => string,
  matchups?: SleeperMatchup[] | null,
): Promise<{ teamName: string; reason: string }> {
  const fromMatchups = matchups ? pickVillainFromMatchups(matchups, rosterNameByTeamId) : null;
  if (fromMatchups) return Promise.resolve(fromMatchups);
  return getMatchups(leagueId, week)
    .then((m) => pickVillainFromMatchups(m, rosterNameByTeamId))
    .then((v) => {
      if (v) return v;
      const lucky = rankings.filter((r) => r.luckDelta > 0.3).sort((a, b) => b.luckDelta - a.luckDelta)[0];
      if (lucky)
        return {
          teamName: lucky.teamName,
          reason: `Winning more than the numbers say they should. Luck delta: +${lucky.luckDelta}.`,
        };
      return {
        teamName: rankings[0]?.teamName ?? "Someone",
        reason: "Took down the top of the rankings this week.",
      };
    })
    .catch(() => ({
      teamName: rankings[0]?.teamName ?? "Someone",
      reason: "Took down the top of the rankings this week.",
    }));
}

/**
 * Pick fraud alert: team with good record but low power score / "danger ahead" commentary.
 */
function pickFraud(rankings: PowerRankingRow[]): { teamName: string; reason: string } {
  const fraudCandidates = rankings.filter(
    (r) => r.wins >= 3 && r.commentary === "Winning games, but the numbers suggest danger ahead.",
  );
  const pick = fraudCandidates.length
    ? fraudCandidates.sort((a, b) => a.powerScore - b.powerScore)[0]
    : rankings.find((r) => r.wins >= 3 && r.averagePoints < (rankings.reduce((s, x) => s + x.averagePoints, 0) / rankings.length));
  if (pick)
    return {
      teamName: pick.teamName,
      reason: `${pick.record} record but bottom half in points scored. The standings are lying.`,
    };
  const fallback = rankings.find((r) => r.wins >= 2 && r.luckDelta > 0.5);
  if (fallback)
    return {
      teamName: fallback.teamName,
      reason: "Record looks better than the underlying numbers.",
    };
  return {
    teamName: rankings[rankings.length - 1]?.teamName ?? "Someone",
    reason: "Keeping the basement warm for now.",
  };
}

/**
 * Build week matchups for email: one row per pair (teamA/scoreA vs teamB/scoreB).
 * Only includes pairs (matchup_id with exactly 2 rosters). Higher score first.
 */
function buildWeekMatchups(
  matchups: SleeperMatchup[],
  rosterNameByTeamId: (teamId: string) => string,
): { teamA: string; scoreA: number; teamB: string; scoreB: number }[] {
  const byMatchup = new Map<number, { roster_id: number; points: number }[]>();
  for (const m of matchups) {
    if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
    byMatchup.get(m.matchup_id)!.push({ roster_id: m.roster_id, points: safeNum(m.points) });
  }
  const out: { teamA: string; scoreA: number; teamB: string; scoreB: number }[] = [];
  for (const rows of Array.from(byMatchup.values())) {
    if (rows.length !== 2) continue;
    const [a, b] = rows;
    const nameA = rosterNameByTeamId(String(a.roster_id));
    const nameB = rosterNameByTeamId(String(b.roster_id));
    if (a.points >= b.points) {
      out.push({ teamA: nameA, scoreA: a.points, teamB: nameB, scoreB: b.points });
    } else {
      out.push({ teamA: nameB, scoreA: b.points, teamB: nameA, scoreB: a.points });
    }
  }
  return out;
}

/**
 * Compute biggest riser and faller from current rankings vs previous week.
 * Riser = largest positive rank change; faller = largest negative change.
 */
function computeBiggestMovers(
  rankings: PowerRankingRow[],
  previousRankings: { teamId: string; rank: number }[],
): { riser?: { teamName: string; change: number }; faller?: { teamName: string; change: number } } {
  if (!previousRankings.length) return {};
  const prevByTeam = new Map(previousRankings.map((p) => [p.teamId, p.rank]));
  let bestRiser: { teamName: string; change: number } | undefined;
  let bestFaller: { teamName: string; change: number } | undefined;
  for (const r of rankings) {
    const prevRank = prevByTeam.get(r.teamId);
    if (prevRank == null) continue;
    const change = prevRank - r.rank; // positive = moved up
    if (change > 0 && (!bestRiser || change > bestRiser.change)) {
      bestRiser = { teamName: r.teamName, change };
    }
    if (change < 0 && (!bestFaller || change < bestFaller.change)) {
      bestFaller = { teamName: r.teamName, change };
    }
  }
  return { ...(bestRiser && { riser: bestRiser }), ...(bestFaller && { faller: bestFaller }) };
}

function topPerformersForRow(
  row: SleeperMatchup,
  playersById: Record<string, SleeperPlayerLite> | null,
  limit = 4,
): string[] {
  const points = row.players_points || row.starters_points || {};
  const ids = row.starters && row.starters.length ? row.starters : Object.keys(points);
  return ids
    .map((pid) => ({ pid, pts: safeNum(points[pid]) }))
    .filter((x) => x.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, limit)
    .map(({ pid }) => {
      if (!playersById) return `Player ${pid}`;
      const p = playersById[pid];
      return p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || `Player ${pid}`;
    });
}

function computeWeeklySuperlatives(
  matchups: SleeperMatchup[],
  rosterNameByTeamId: (teamId: string) => string,
  playersById: Record<string, SleeperPlayerLite> | null,
): WeeklyEmailData["weeklySuperlatives"] {
  if (!matchups.length) return undefined;
  const sorted = [...matchups].sort((a, b) => safeNum(b.points) - safeNum(a.points));
  const high = sorted[0];
  const low = sorted[sorted.length - 1];
  if (!high || !low) return undefined;

  type WorstCoach = NonNullable<NonNullable<WeeklyEmailData["weeklySuperlatives"]>["worstCoach"]>;
  let worstCoach: WorstCoach | undefined;
  for (const row of matchups) {
    if (!row.players?.length) continue;
    const pts = row.players_points || row.starters_points || {};
    const starters = new Set(row.starters || []);
    const benchPoints = row.players
      .filter((pid) => !starters.has(pid))
      .reduce((sum, pid) => sum + Math.max(0, safeNum(pts[pid])), 0);
    if (!Number.isFinite(benchPoints) || benchPoints <= 0) continue;
    if (!worstCoach || benchPoints > worstCoach.benchPoints) {
      const topBench = row.players
        .filter((pid) => !starters.has(pid))
        .map((pid) => ({ pid, pts: safeNum(pts[pid]) }))
        .sort((a, b) => b.pts - a.pts)[0];
      const lowStarter = (row.starters || [])
        .map((pid) => ({ pid, pts: safeNum(pts[pid]) }))
        .sort((a, b) => a.pts - b.pts)[0];
      const benchName = topBench
        ? (playersById?.[topBench.pid]?.full_name || [playersById?.[topBench.pid]?.first_name, playersById?.[topBench.pid]?.last_name].filter(Boolean).join(" ") || `Player ${topBench.pid}`)
        : "";
      const starterName = lowStarter
        ? (playersById?.[lowStarter.pid]?.full_name || [playersById?.[lowStarter.pid]?.first_name, playersById?.[lowStarter.pid]?.last_name].filter(Boolean).join(" ") || `Player ${lowStarter.pid}`)
        : "";
      worstCoach = {
        teamName: rosterNameByTeamId(String(row.roster_id)),
        benchPoints,
        ...(benchName && starterName ? { sitStartMiss: `${benchName} should have started over ${starterName}.` } : {}),
      };
    }
  }

  return {
    highScore: {
      teamName: rosterNameByTeamId(String(high.roster_id)),
      points: safeNum(high.points),
      keyPerformers: topPerformersForRow(high, playersById),
    },
    lowScore: {
      teamName: rosterNameByTeamId(String(low.roster_id)),
      points: safeNum(low.points),
    },
    ...(worstCoach ? { worstCoach } : {}),
  };
}

function computeLeagueAverages(teams: PowerRankingsTeamInput[], weekMatchups: SleeperMatchup[]): WeeklyEmailData["leagueAverages"] {
  const weekScores = weekMatchups.map((m) => safeNum(m.points)).filter((x) => x > 0);
  const seasonScores = teams.flatMap((t) => t.weeklyScores || []).filter((x) => x > 0);
  if (!weekScores.length && !seasonScores.length) return undefined;
  return {
    weekAverage: average(weekScores),
    seasonAverage: average(seasonScores),
  };
}

function computeSeasonRaces(
  teams: PowerRankingsTeamInput[],
  rosters: RosterWithPoints[],
): WeeklyEmailData["seasonRaces"] {
  if (!teams.length) return undefined;
  const withGames = teams.map((t) => ({ ...t, games: Math.max(1, t.weeklyScores?.length || t.wins + t.losses || 1) }));
  const topScoring = [...withGames].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const lowestScoring = [...withGames].sort((a, b) => a.pointsFor - b.pointsFor)[0];
  const pointsAgainstRows = withGames.map((t) => {
    const r = rosters.find((x) => String(x.roster_id) === t.teamId);
    const totalPA = safeNum(r?.settings?.fpts_against) + safeNum(r?.settings?.fpts_against_decimal) / 100;
    return { teamName: t.teamName, totalPA, games: t.games };
  }).filter((x) => x.totalPA > 0);
  const luckiest = [...pointsAgainstRows].sort((a, b) => a.totalPA - b.totalPA)[0];
  const unluckiest = [...pointsAgainstRows].sort((a, b) => b.totalPA - a.totalPA)[0];
  return {
    topScoringPace: topScoring ? { teamName: topScoring.teamName, totalPoints: topScoring.pointsFor, pointsPerGame: topScoring.pointsFor / topScoring.games } : undefined,
    lowestScoringPace: lowestScoring ? { teamName: lowestScoring.teamName, totalPoints: lowestScoring.pointsFor, pointsPerGame: lowestScoring.pointsFor / lowestScoring.games } : undefined,
    luckiestByPointsAgainst: luckiest ? { teamName: luckiest.teamName, totalPointsAgainst: luckiest.totalPA, pointsAgainstPerGame: luckiest.totalPA / luckiest.games } : undefined,
    unluckiestByPointsAgainst: unluckiest ? { teamName: unluckiest.teamName, totalPointsAgainst: unluckiest.totalPA, pointsAgainstPerGame: unluckiest.totalPA / unluckiest.games } : undefined,
  };
}

async function computePositionLeaders(
  leagueId: string,
  throughWeek: number,
  rosterNameByTeamId: (teamId: string) => string,
): Promise<WeeklyEmailData["positionLeaders"]> {
  const cacheKey = `${leagueId}:${throughWeek}`;
  const cached = positionLeadersCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let playersById: Record<string, SleeperPlayerLite>;
  try {
    playersById = await getNflPlayers();
  } catch {
    console.log(JSON.stringify({ event: "weekly_email_position_leaders_skipped", leagueId, throughWeek, reason: "players_fetch_failed" }));
    return undefined;
  }
  const allowed = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
  const totals = new Map<string, { points: number; games: number; rosterId: number }>();
  for (let w = 1; w <= throughWeek; w++) {
    let rows: SleeperMatchup[] = [];
    try {
      rows = await getMatchups(leagueId, w);
    } catch {
      continue;
    }
    for (const row of rows) {
      const pp = row.players_points || row.starters_points || {};
      const starters = row.starters && row.starters.length ? row.starters : Object.keys(pp);
      for (const pid of starters) {
        const p = playersById[pid];
        const pos = p?.position === "DST" ? "DEF" : p?.position;
        if (!pos || !allowed.has(pos)) continue;
        const pts = safeNum(pp[pid]);
        if (pts <= 0) continue;
        const key = `${pos}:${pid}`;
        const prev = totals.get(key) || { points: 0, games: 0, rosterId: row.roster_id };
        prev.points += pts;
        prev.games += 1;
        totals.set(key, prev);
      }
    }
  }
  if (!totals.size) return undefined;
  const bestByPos = new Map<string, { playerId: string; avg: number; rosterId: number }>();
  for (const [key, agg] of Array.from(totals.entries())) {
    const [pos, pid] = key.split(":");
    const avgPts = agg.points / Math.max(1, agg.games);
    const prev = bestByPos.get(pos);
    if (!prev || avgPts > prev.avg) bestByPos.set(pos, { playerId: pid, avg: avgPts, rosterId: agg.rosterId });
  }
  if (!bestByPos.size) return undefined;
  const order = ["QB", "RB", "WR", "TE", "DEF", "K"];
  const out = order
    .filter((pos) => bestByPos.has(pos))
    .map((pos) => {
      const best = bestByPos.get(pos)!;
      const p = playersById[best.playerId];
      const playerName = p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || `Player ${best.playerId}`;
      return {
        position: pos,
        playerName,
        avgPoints: best.avg,
        teamName: rosterNameByTeamId(String(best.rosterId)),
      };
    });
  positionLeadersCache.set(cacheKey, { expiresAt: Date.now() + POSITION_LEADERS_CACHE_TTL_MS, value: out });
  return out;
}

/**
 * One-line intro summary for the week (deterministic).
 */
function buildIntroSummary(week: number, rankings: PowerRankingRow[]): string {
  const top = rankings[0];
  const fraud = rankings.find((r) => r.commentary === "Winning games, but the numbers suggest danger ahead.");
  if (top && fraud)
    return `Week ${week} is in the books. ${top.teamName} leads the power rankings, but ${fraud.teamName} is winning games the numbers don't love.`;
  if (top)
    return `Week ${week} is in the books. Here's where everyone stands—${top.teamName} sits at the top of the power rankings.`;
  return `Week ${week} is in the books. Time for the weekly power rankings.`;
}

export interface WeeklyCommissionerResult {
  leagueName: string;
  week: number;
  rankings: PowerRankingRow[];
  emailHtml: string;
  emailPayload: WeeklyEmailData;
}

/**
 * Full pipeline: fetch Sleeper data, run power rankings, build villain/fraud/intro, generate email.
 * Optional previousRankings (e.g. from last week's stored result) for trend arrows.
 * Optional commissionerNote rendered above the intro in the email.
 * Optional appUrl for "Want this for your league?" CTA in the footer.
 */
export async function getWeeklyCommissionerEmail(
  leagueId: string,
  week: number,
  previousRankings: { teamId: string; rank: number }[] = [],
  commissionerNote?: string,
  commissionerSignoff?: string,
  appUrl?: string,
  includeV2 = true,
): Promise<WeeklyCommissionerResult> {
  const startMs = Date.now();
  const { leagueName, teams } = await buildTeamsFromSleeper(leagueId, week);
  if (teams.length === 0) {
    throw new Error("No team data available for this league and week.");
  }

  const rankings = generatePowerRankings(teams, previousRankings);
  const rosterNameByTeamId = (teamId: string) => {
    const t = teams.find((x) => x.teamId === teamId);
    return t?.teamName ?? teamId;
  };

  let weekMatchupsRaw: SleeperMatchup[] = [];
  try {
    weekMatchupsRaw = await getMatchups(leagueId, week);
  } catch {
    // omit weekMatchups from payload
  }

  const [villainOfTheWeek, fraudAlert] = await Promise.all([
    pickVillain(leagueId, week, rankings, rosterNameByTeamId, weekMatchupsRaw),
    Promise.resolve(pickFraud(rankings)),
  ]);

  let introSummary = buildIntroSummary(week, rankings);
  if (weekMatchupsRaw.length > 0 && includeV2) {
    try {
      const narrative = await buildWeeklyRoastNarrative({
        league: { league_id: leagueId, name: leagueName, season: undefined },
        week,
        matchups: weekMatchupsRaw,
        rosterName: (rid: number) => rosterNameByTeamId(String(rid)),
      });
      introSummary = `${narrative.headline} ${narrative.groupChatSummary}`;
    } catch (e) {
      console.log(
        JSON.stringify({
          event: "weekly_roast_narrative_email_fallback",
          leagueId,
          week,
          err: String(e),
        }),
      );
    }
  }
  const biggestMovers = computeBiggestMovers(rankings, previousRankings);
  const weekMatchups = buildWeekMatchups(weekMatchupsRaw, rosterNameByTeamId);
  const rosters = (await getRosters(leagueId)) as RosterWithPoints[];
  let playersById: Record<string, SleeperPlayerLite> | null = null;
  try {
    playersById = await getNflPlayers();
  } catch {
    playersById = null;
  }
  const weeklySuperlatives = includeV2 ? computeWeeklySuperlatives(weekMatchupsRaw, rosterNameByTeamId, playersById) : undefined;
  const leagueAverages = includeV2 ? computeLeagueAverages(teams, weekMatchupsRaw) : undefined;
  const seasonRaces = includeV2 ? computeSeasonRaces(teams, rosters) : undefined;
  let positionLeaders: WeeklyEmailData["positionLeaders"] | undefined;
  if (includeV2) {
    try {
      positionLeaders = await withTimeout(computePositionLeaders(leagueId, week, rosterNameByTeamId), POSITION_LEADERS_MAX_MS);
    } catch {
      positionLeaders = undefined;
      console.log(JSON.stringify({ event: "weekly_email_position_leaders_skipped", leagueId, week, reason: "timeout_or_error" }));
    }
  }

  const matchupPairs = weekMatchups.map((m) => ({ teamA: m.teamA, teamB: m.teamB }));
  const narratives = await getLeagueHistoryNarratives(leagueId, matchupPairs);

  // If matchup-to-watch was a nemesis (victim "has never beaten" dominator) and victim won this week, add story of the week
  let storyOfTheWeek = narratives.storyOfTheWeek;
  if (narratives.matchupToWatch && weekMatchups.length > 0) {
    const nar = narratives.matchupToWatch.narrative;
    if (nar.includes("has never beaten")) {
      const victim = narratives.matchupToWatch.teamA;
      const dominator = narratives.matchupToWatch.teamB;
      const row = weekMatchups.find(
        (m) =>
          (m.teamA === victim && m.teamB === dominator) || (m.teamA === dominator && m.teamB === victim),
      );
      if (row) {
        const victimWon =
          (row.teamA === victim && row.scoreA > row.scoreB) || (row.teamB === victim && row.scoreB > row.scoreA);
        if (victimWon) storyOfTheWeek = { narrative: `Finally: ${victim} gets the W over ${dominator}.` };
      }
    }
  }

  const emailRankings: WeeklyEmailRankingRow[] = rankings.map((r) => ({
    rank: r.rank,
    teamName: r.teamName,
    record: r.record,
    powerScore: r.powerScore,
    trend: r.trend,
    commentary: r.commentary,
  }));

  const emailPayload: WeeklyEmailData = {
    leagueName,
    week,
    rankings: emailRankings,
    villainOfTheWeek,
    fraudAlert,
    introSummary,
    ...(commissionerNote?.trim() ? { commissionerNote: commissionerNote.trim() } : {}),
    ...(commissionerSignoff?.trim() ? { commissionerSignoff: commissionerSignoff.trim().slice(0, 180) } : {}),
    ...(Object.keys(biggestMovers).length > 0 ? { biggestMovers } : {}),
    ...(weekMatchups.length > 0 ? { weekMatchups } : {}),
    ...(weeklySuperlatives ? { weeklySuperlatives } : {}),
    ...(leagueAverages ? { leagueAverages } : {}),
    ...(seasonRaces ? { seasonRaces } : {}),
    ...(positionLeaders && positionLeaders.length > 0 ? { positionLeaders } : {}),
    ...(narratives.matchupToWatch ? { matchupToWatch: narratives.matchupToWatch } : {}),
    ...(storyOfTheWeek ? { storyOfTheWeek } : {}),
    ...(appUrl?.trim() ? { appUrl: appUrl.trim() } : {}),
  };

  const emailHtml = generateWeeklyEmail(emailPayload);
  console.log(JSON.stringify({
    event: "weekly_email_recap_generated",
    leagueId,
    week,
    includeV2,
    durationMs: Date.now() - startMs,
    hasPositionLeaders: Boolean(positionLeaders?.length),
  }));

  return {
    leagueName,
    week,
    rankings,
    emailHtml,
    emailPayload,
  };
}

/** Build recap email subject; when matchupToWatch exists, include team names to improve opens. */
export function getRecapSubject(leagueName: string, week: number, emailPayload: WeeklyEmailData): string {
  const m = emailPayload.matchupToWatch;
  if (m?.teamA && m?.teamB) {
    return `${leagueName} — Week ${week}: ${m.teamA} vs ${m.teamB} + Power Rankings`;
  }
  return `${leagueName} — Week ${week} Power Rankings`;
}

/** V1 API: generate weekly commissioner email content. Returns subject, html, and plain text. */
export async function generateWeeklyCommissionerEmail(
  leagueId: string,
  week: number,
  previousRankings: { teamId: string; rank: number }[] = [],
  commissionerNote?: string,
  commissionerSignoff?: string,
  appUrl?: string,
  includeV2 = true,
): Promise<{ subject: string; html: string; text: string }> {
  const result = await getWeeklyCommissionerEmail(leagueId, week, previousRankings, commissionerNote, commissionerSignoff, appUrl, includeV2);
  const subject = getRecapSubject(result.leagueName, result.week, result.emailPayload);
  const text = generateWeeklyEmailPlainText(result.emailPayload);
  return { subject, html: result.emailHtml, text };
}
