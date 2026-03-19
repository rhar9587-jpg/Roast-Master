/**
 * Fantasy Roast — Weekly Preview Email (pre-week matchups, blowout/upset, projections).
 * Uses rankings through week N-1 and matchups for week N (pairings only).
 */

import { getMatchups } from "../league-history/sleeper";
import type { SleeperMatchup } from "../league-history/sleeper";
import { buildTeamsFromSleeper } from "./weeklyCommissioner";
import type { PowerRankingRow } from "./powerRankings";
import { generatePowerRankings } from "./powerRankings";
import { getStoredPreviousRankings } from "./weeklyRankingsStore";
import { getLeagueHistoryNarratives, type MatchupPair } from "./weeklyEmailNarratives";
import { generateWeeklyEmail, generateWeeklyEmailPlainText, type WeeklyEmailData } from "./weeklyEmail";

function safeNum(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Build upcoming matchups (pairings only) and optional win % from power scores.
 * Win % from power-score diff: 50 + (scoreA - scoreB) * 0.5, clamped 5–95.
 */
function buildUpcomingMatchups(
  matchups: SleeperMatchup[],
  rosterNameByTeamId: (id: string) => string,
  scoreByTeamId: Map<string, number>,
): Array<{ teamA: string; teamB: string; winPctA?: number; winPctB?: number }> {
  const byMatchup = new Map<number, { roster_id: number; points: number }[]>();
  for (const m of matchups) {
    if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
    byMatchup.get(m.matchup_id)!.push({ roster_id: m.roster_id, points: safeNum(m.points) });
  }
  const out: Array<{ teamA: string; teamB: string; winPctA?: number; winPctB?: number }> = [];
  for (const rows of Array.from(byMatchup.values())) {
    if (rows.length !== 2) continue;
    const [a, b] = rows;
    const teamIdA = String(a.roster_id);
    const teamIdB = String(b.roster_id);
    const nameA = rosterNameByTeamId(teamIdA);
    const nameB = rosterNameByTeamId(teamIdB);
    const scoreA = scoreByTeamId.get(teamIdA) ?? 50;
    const scoreB = scoreByTeamId.get(teamIdB) ?? 50;
    const diff = scoreA - scoreB;
    const winPctA = 1 / (1 + Math.exp(-diff / 25));
    const pctA = Math.max(5, Math.min(95, Math.round(100 * winPctA)));
    const pctB = 100 - pctA;
    out.push({
      teamA: nameA,
      teamB: nameB,
      winPctA: pctA,
      winPctB: pctB,
    });
  }
  return out;
}

/**
 * Likely blowout: matchup with largest power-score gap (favorite vs underdog by rank).
 */
function pickLikelyBlowout(
  upcomingMatchups: Array<{ teamA: string; teamB: string }>,
  rankings: PowerRankingRow[],
): { teamA: string; teamB: string; narrative: string } | null {
  if (!rankings.length || !upcomingMatchups.length) return null;
  const rankByName = new Map(rankings.map((r, i) => [r.teamName, { rank: i + 1, powerScore: r.powerScore }]));
  let best: { teamA: string; teamB: string; gap: number; rankA: number; rankB: number } | null = null;
  for (const mu of upcomingMatchups) {
    const ra = rankByName.get(mu.teamA);
    const rb = rankByName.get(mu.teamB);
    if (!ra || !rb) continue;
    const gap = Math.abs(ra.powerScore - rb.powerScore);
    const [fav, und] = ra.powerScore >= rb.powerScore ? [mu.teamA, mu.teamB] : [mu.teamB, mu.teamA];
    const [rankFav, rankUnd] = ra.powerScore >= rb.powerScore ? [ra.rank, rb.rank] : [rb.rank, ra.rank];
    if (!best || gap > best.gap) best = { teamA: fav, teamB: und, gap, rankA: rankFav, rankB: rankUnd };
  }
  if (!best) return null;
  return {
    teamA: best.teamA,
    teamB: best.teamB,
    narrative: `Biggest power gap this week: ${best.teamA} (rank ${best.rankA}) vs ${best.teamB} (rank ${best.rankB}).`,
  };
}

/**
 * Upset of the week: underdog (by rank) with strong underlying numbers (expectedWins or luckDelta).
 */
function pickUpsetOfTheWeek(
  upcomingMatchups: Array<{ teamA: string; teamB: string }>,
  rankings: PowerRankingRow[],
): { underdog: string; favorite: string; narrative: string } | null {
  if (!rankings.length || !upcomingMatchups.length) return null;
  const byName = new Map(rankings.map((r) => [r.teamName, r]));
  let best: { underdog: string; favorite: string; score: number } | null = null;
  for (const mu of upcomingMatchups) {
    const ra = byName.get(mu.teamA);
    const rb = byName.get(mu.teamB);
    if (!ra || !rb) continue;
    const [underdog, favorite] = ra.rank <= rb.rank ? [mu.teamB, mu.teamA] : [mu.teamA, mu.teamB];
    const underdogRow = ra.rank <= rb.rank ? rb : ra;
    const upsetScore = underdogRow.expectedWins + (underdogRow.luckDelta > 0 ? underdogRow.luckDelta * 2 : 0);
    if (upsetScore > 0 && (!best || upsetScore > best.score))
      best = { underdog, favorite, score: upsetScore };
  }
  if (!best) return null;
  return {
    underdog: best.underdog,
    favorite: best.favorite,
    narrative: `The numbers like ${best.underdog} to keep it close—or pull the upset—vs ${best.favorite}.`,
  };
}

export interface WeeklyPreviewResult {
  leagueName: string;
  week: number;
  emailHtml: string;
  emailPayload: WeeklyEmailData;
}

/**
 * Build preview email for upcoming week: rankings through week-1, matchups for week (pairings),
 * likely blowout, upset watch, win projections, and league-history narratives.
 */
export async function getWeeklyPreviewEmail(
  leagueId: string,
  week: number,
  commissionerNote?: string,
  appUrl?: string,
): Promise<WeeklyPreviewResult> {
  const throughWeek = Math.max(1, week - 1);
  const { leagueName, teams } = await buildTeamsFromSleeper(leagueId, throughWeek);
  const previousRankings = getStoredPreviousRankings(leagueId, week);
  const rankings = teams.length > 0 ? generatePowerRankings(teams, previousRankings) : [];
  const rosterNameByTeamId = (teamId: string) => {
    const t = teams.find((x) => x.teamId === teamId);
    return t?.teamName ?? teamId;
  };

  let matchupsRaw: SleeperMatchup[] = [];
  try {
    matchupsRaw = await getMatchups(leagueId, week);
  } catch {
    // no matchups for this week yet
  }

  const scoreByTeamId = new Map(rankings.map((r) => [r.teamId, r.powerScore]));
  const upcomingMatchups = buildUpcomingMatchups(matchupsRaw, rosterNameByTeamId, scoreByTeamId);
  const likelyBlowout = pickLikelyBlowout(upcomingMatchups, rankings);
  const upsetOfTheWeek = pickUpsetOfTheWeek(upcomingMatchups, rankings);

  const pairs: MatchupPair[] = upcomingMatchups.map((m) => ({ teamA: m.teamA, teamB: m.teamB }));
  const narratives = await getLeagueHistoryNarratives(leagueId, pairs);

  const introSummary =
    week === 1
      ? "Week 1 is here. No power rankings yet—check back after the first week."
      : `Week ${week} is here. Here's what to watch.`;

  const emailPayload: WeeklyEmailData = {
    leagueName,
    week,
    introSummary,
    mode: "preview",
    ...(commissionerNote?.trim() ? { commissionerNote: commissionerNote.trim() } : {}),
    ...(week === 1 ? { previewDisclaimer: "Win % and blowout/upset picks will appear after Week 1." } : {}),
    ...(upcomingMatchups.length > 0 ? { upcomingMatchups } : {}),
    ...(likelyBlowout ? { likelyBlowout } : {}),
    ...(upsetOfTheWeek ? { upsetOfTheWeek } : {}),
    ...(narratives.matchupToWatch ? { matchupToWatch: narratives.matchupToWatch } : {}),
    ...(narratives.storyOfTheWeek ? { storyOfTheWeek: narratives.storyOfTheWeek } : {}),
    ...(appUrl?.trim() ? { appUrl: appUrl.trim() } : {}),
  };

  const emailHtml = generateWeeklyEmail(emailPayload);

  return {
    leagueName,
    week,
    emailHtml,
    emailPayload,
  };
}

/** Returns subject, html, and plain text for preview email (e.g. for sending via Resend). */
export async function generateWeeklyPreviewEmail(
  leagueId: string,
  week: number,
  commissionerNote?: string,
  appUrl?: string,
): Promise<{ subject: string; html: string; text: string }> {
  const result = await getWeeklyPreviewEmail(leagueId, week, commissionerNote, appUrl);
  const subject = `${result.leagueName} — Week ${result.week} Matchup Preview`;
  const text = generateWeeklyEmailPlainText(result.emailPayload);
  return { subject, html: result.emailHtml, text };
}
