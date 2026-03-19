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

function safeNum(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
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
  appUrl?: string,
): Promise<WeeklyCommissionerResult> {
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

  const introSummary = buildIntroSummary(week, rankings);
  const biggestMovers = computeBiggestMovers(rankings, previousRankings);
  const weekMatchups = buildWeekMatchups(weekMatchupsRaw, rosterNameByTeamId);

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
    ...(Object.keys(biggestMovers).length > 0 ? { biggestMovers } : {}),
    ...(weekMatchups.length > 0 ? { weekMatchups } : {}),
    ...(narratives.matchupToWatch ? { matchupToWatch: narratives.matchupToWatch } : {}),
    ...(storyOfTheWeek ? { storyOfTheWeek } : {}),
    ...(appUrl?.trim() ? { appUrl: appUrl.trim() } : {}),
  };

  const emailHtml = generateWeeklyEmail(emailPayload);

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
  appUrl?: string,
): Promise<{ subject: string; html: string; text: string }> {
  const result = await getWeeklyCommissionerEmail(leagueId, week, previousRankings, commissionerNote, appUrl);
  const subject = getRecapSubject(result.leagueName, result.week, result.emailPayload);
  const text = generateWeeklyEmailPlainText(result.emailPayload);
  return { subject, html: result.emailHtml, text };
}
