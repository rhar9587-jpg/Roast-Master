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

/** Closest power-rank odds to a coin flip. */
function pickTightestMatchup(
  upcoming: Array<{ teamA: string; teamB: string; winPctA?: number; winPctB?: number }>,
): WeeklyEmailData["tightestMatchup"] {
  let best: NonNullable<WeeklyEmailData["tightestMatchup"]> | null = null;
  let bestDist = Infinity;
  for (const mu of upcoming) {
    if (mu.winPctA == null || mu.winPctB == null) continue;
    const dist = Math.abs(mu.winPctA - 50);
    if (dist < bestDist) {
      bestDist = dist;
      best = {
        teamA: mu.teamA,
        teamB: mu.teamB,
        winPctA: mu.winPctA,
        winPctB: mu.winPctB,
        narrative: `Power ranks call this a coin flip (${mu.winPctA}% / ${mu.winPctB}%). Don’t sleep on either side.`,
      };
    }
  }
  return best ?? undefined;
}

/** Hot recent form vs cold — largest recentFormAverage gap among upcoming pairs. */
function pickFormMatchup(
  upcoming: Array<{ teamA: string; teamB: string }>,
  rankings: PowerRankingRow[],
): WeeklyEmailData["formMatchup"] {
  if (rankings.length < 2 || !upcoming.length) return undefined;
  const byName = new Map(rankings.map((r) => [r.teamName, r]));
  let best: { teamA: string; teamB: string; gap: number; hot: string; cold: string; hotAvg: number; coldAvg: number } | null =
    null;
  for (const mu of upcoming) {
    const ra = byName.get(mu.teamA);
    const rb = byName.get(mu.teamB);
    if (!ra || !rb) continue;
    const gap = Math.abs(ra.recentFormAverage - rb.recentFormAverage);
    if (gap < 8) continue;
    const [hot, cold, hotAvg, coldAvg] =
      ra.recentFormAverage >= rb.recentFormAverage
        ? [mu.teamA, mu.teamB, ra.recentFormAverage, rb.recentFormAverage]
        : [mu.teamB, mu.teamA, rb.recentFormAverage, ra.recentFormAverage];
    if (!best || gap > best.gap) best = { teamA: mu.teamA, teamB: mu.teamB, gap, hot, cold, hotAvg, coldAvg };
  }
  if (!best) return undefined;
  return {
    teamA: best.teamA,
    teamB: best.teamB,
    narrative: `${best.hot} is cooking lately (${best.hotAvg.toFixed(1)} avg last few weeks) while ${best.cold} is ice cold (${best.coldAvg.toFixed(1)}). Form vs form.`,
  };
}

function buildPreviewPowerBoard(
  rankings: PowerRankingRow[],
  previousRankings: { teamId: string; rank: number }[],
): {
  board: NonNullable<WeeklyEmailData["previewPowerBoard"]>;
  mover?: WeeklyEmailData["previewBiggestMover"];
} {
  const board = rankings.slice(0, 5).map((r) => ({
    rank: r.rank,
    teamName: r.teamName,
    record: r.record,
    powerScore: r.powerScore,
    trend: r.trend,
  }));
  let mover: WeeklyEmailData["previewBiggestMover"];
  if (previousRankings.length) {
    const prevByTeam = new Map(previousRankings.map((p) => [p.teamId, p.rank]));
    let bestAbs = 0;
    for (const r of rankings) {
      const prev = prevByTeam.get(r.teamId);
      if (prev == null) continue;
      const change = prev - r.rank;
      if (Math.abs(change) > bestAbs && change !== 0) {
        bestAbs = Math.abs(change);
        mover = {
          teamName: r.teamName,
          change: Math.abs(change),
          direction: change > 0 ? "up" : "down",
        };
      }
    }
  }
  return { board, mover };
}

export interface WeeklyPreviewResult {
  leagueName: string;
  week: number;
  emailHtml: string;
  emailPayload: WeeklyEmailData;
}

/**
 * Build preview email for upcoming week: rankings through week-1, matchups for week (pairings),
 * likely blowout, upset watch, power-rank odds, and league-history narratives.
 */
export async function getWeeklyPreviewEmail(
  leagueId: string,
  week: number,
  commissionerNote?: string,
  commissionerSignoff?: string,
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
  const tightestMatchup = pickTightestMatchup(upcomingMatchups);
  const formMatchup = pickFormMatchup(upcomingMatchups, rankings);
  const { board: previewPowerBoard, mover: previewBiggestMover } =
    week > 1 && rankings.length ? buildPreviewPowerBoard(rankings, previousRankings) : { board: [], mover: undefined };

  const pairs: MatchupPair[] = upcomingMatchups.map((m) => ({ teamA: m.teamA, teamB: m.teamB }));
  const narratives = await getLeagueHistoryNarratives(leagueId, pairs);

  const introSummary =
    week === 1
      ? "Week 1 is here. No power rankings yet—check back after the first week."
      : `Week ${week} is here. Power-rank odds below — not player projections. Here's what to watch.`;

  const emailPayload: WeeklyEmailData = {
    leagueName,
    week,
    introSummary,
    mode: "preview",
    ...(commissionerNote?.trim() ? { commissionerNote: commissionerNote.trim() } : {}),
    ...(commissionerSignoff?.trim() ? { commissionerSignoff: commissionerSignoff.trim().slice(0, 180) } : {}),
    ...(week === 1
      ? { previewDisclaimer: "Power-rank odds and blowout/upset picks will appear after Week 1." }
      : { previewDisclaimer: "Win % is based on power rankings through last week — not player projections." }),
    ...(previewPowerBoard.length > 0 ? { previewPowerBoard } : {}),
    ...(previewBiggestMover ? { previewBiggestMover } : {}),
    ...(upcomingMatchups.length > 0 ? { upcomingMatchups } : {}),
    ...(tightestMatchup ? { tightestMatchup } : {}),
    ...(formMatchup ? { formMatchup } : {}),
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
  commissionerSignoff?: string,
  appUrl?: string,
): Promise<{ subject: string; html: string; text: string }> {
  const result = await getWeeklyPreviewEmail(leagueId, week, commissionerNote, commissionerSignoff, appUrl);
  const subject = `${result.leagueName} — Week ${result.week} Matchup Preview`;
  const text = generateWeeklyEmailPlainText(result.emailPayload);
  return { subject, html: result.emailHtml, text };
}
