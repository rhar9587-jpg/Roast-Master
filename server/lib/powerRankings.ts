/**
 * Fantasy Roast — Power Rankings Engine (V1)
 * Simple, explainable formula: no prediction model, deterministic and transparent.
 */

import { formatTeamRecord } from "./domain/teamStateThroughWeek";

/** Explicit week identity for score history (never positional). */
export type WeekKeyedScore = { week: number; score: number };

export interface PowerRankingsTeamInput {
  teamId: string;
  teamName: string;
  /** Stable owner key when available (`owner:…` / `roster:…`). */
  ownerKey?: string;
  wins: number;
  losses: number;
  ties?: number;
  pointsFor: number;
  pointsAgainst?: number;
  /** Week-keyed scores; absent weeks are omitted — never padded with zeros. */
  weeklyScores: WeekKeyedScore[];
}

export interface PreviousRanking {
  teamId: string;
  rank: number;
}

export interface PowerRankingRow {
  rank: number;
  teamId: string;
  teamName: string;
  record: string;
  powerScore: number;
  trend: "up" | "down" | "flat";
  commentary: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  winPct: number;
  averagePoints: number;
  recentFormAverage: number;
  expectedWins: number;
  luckDelta: number;
}

function normalizeTo100(value: number, minVal: number, maxVal: number): number {
  const range = maxVal - minVal;
  if (range <= 0) return 50;
  const clamped = Math.max(minVal, Math.min(maxVal, value));
  return (100 * (clamped - minVal)) / range;
}

function safeAverage(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function scoresByWeek(scores: WeekKeyedScore[] | undefined): Map<number, number> {
  const map = new Map<number, number>();
  for (const entry of scores || []) {
    if (!Number.isFinite(entry?.week) || !Number.isFinite(entry?.score)) continue;
    map.set(entry.week, entry.score);
  }
  return map;
}

/**
 * Expected wins: for each week this team played, compare against opponents
 * who also have a score for that same week. Missing weeks are skipped —
 * no index alignment and no silent zero for absent scores.
 */
export function computeExpectedWins(
  team: PowerRankingsTeamInput,
  allTeams: PowerRankingsTeamInput[],
): number {
  const myByWeek = scoresByWeek(team.weeklyScores);
  if (myByWeek.size === 0 || allTeams.length <= 1) return 0;

  const others = allTeams.filter((t) => t.teamId !== team.teamId);
  if (!others.length) return 0;

  const otherMaps = others.map((t) => scoresByWeek(t.weeklyScores));
  let expectedWins = 0;

  for (const [week, myScore] of Array.from(myByWeek.entries())) {
    let beatCount = 0;
    let compared = 0;
    for (const other of otherMaps) {
      if (!other.has(week)) continue;
      compared += 1;
      if (myScore > other.get(week)!) beatCount += 1;
    }
    if (compared > 0) {
      expectedWins += beatCount / compared;
    }
  }

  return Math.round(expectedWins * 100) / 100;
}

interface EnrichedTeam extends PowerRankingsTeamInput {
  ties: number;
  winPct: number;
  averagePoints: number;
  recentFormAverage: number;
  expectedWins: number;
  luckDelta: number;
}

function enrichTeam(team: PowerRankingsTeamInput, allTeams: PowerRankingsTeamInput[]): EnrichedTeam {
  const wins = team.wins ?? 0;
  const losses = team.losses ?? 0;
  const ties = team.ties ?? 0;
  const games = wins + losses + ties;
  const weeklyScores = team.weeklyScores || [];
  // Half-win for ties (standard fantasy standings treatment)
  const winPct = games > 0 ? (wins + 0.5 * ties) / games : 0;
  const scoreValues = weeklyScores.map((w) => w.score);
  const averagePoints =
    team.pointsFor != null && weeklyScores.length > 0
      ? team.pointsFor / weeklyScores.length
      : safeAverage(scoreValues);
  const recentSorted = [...weeklyScores].sort((a, b) => a.week - b.week);
  const recentFormAverage =
    recentSorted.length > 0
      ? safeAverage(recentSorted.slice(-3).map((w) => w.score))
      : averagePoints;
  const expectedWins = computeExpectedWins(team, allTeams);
  const luckDelta = Math.round((wins - expectedWins) * 100) / 100;
  return {
    ...team,
    ties,
    winPct,
    averagePoints,
    recentFormAverage,
    expectedWins,
    luckDelta,
  };
}

function luckComponent(luckDelta: number, minLuck: number, maxLuck: number): number {
  const range = maxLuck - minLuck;
  if (range <= 0) return 50;
  const normalized = (luckDelta - minLuck) / range;
  return 100 - normalized * 100;
}

function computePowerScore(
  enriched: EnrichedTeam,
  pointsMin: number,
  pointsMax: number,
  recentMin: number,
  recentMax: number,
  luckMin: number,
  luckMax: number,
): number {
  const winPct100 = enriched.winPct * 100;
  const pointsNorm = normalizeTo100(enriched.averagePoints, pointsMin, pointsMax);
  const recentNorm = normalizeTo100(enriched.recentFormAverage, recentMin, recentMax);
  const luckNorm = luckComponent(enriched.luckDelta, luckMin, luckMax);
  const score =
    0.4 * winPct100 + 0.3 * pointsNorm + 0.2 * recentNorm + 0.1 * luckNorm;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function getTrend(
  teamId: string,
  currentRank: number,
  previousRankings: PreviousRanking[],
): "up" | "down" | "flat" {
  if (!previousRankings?.length) return "flat";
  const prev = previousRankings.find((r) => r.teamId === teamId);
  if (!prev || prev.rank == null) return "flat";
  if (currentRank < prev.rank) return "up";
  if (currentRank > prev.rank) return "down";
  return "flat";
}

interface LeagueStats {
  avgPointsLeague: number | null;
  medianPoints: number | null;
  recentFormMedian: number | null;
}

function getCommentary(team: EnrichedTeam, leagueStats: LeagueStats): string {
  const { winPct, averagePoints, recentFormAverage, luckDelta } = team;
  const { avgPointsLeague, medianPoints, recentFormMedian } = leagueStats;
  const isStrongRecord = winPct >= 0.65;
  const isGoodRecord = winPct >= 0.5;
  const isWeakRecord = winPct < 0.5;
  const isHighScoring = averagePoints >= (avgPointsLeague ?? averagePoints);
  const isBelowMedianPoints = medianPoints != null && averagePoints < medianPoints;
  const isAboveMedianPoints = medianPoints != null && averagePoints >= medianPoints;
  const isUnlucky = luckDelta < -0.3;
  const isLucky = luckDelta > 0.3;
  const isHotRecent =
    recentFormMedian != null && recentFormAverage >= recentFormMedian * 1.05;

  if (isStrongRecord && isHighScoring) return "The class of the league right now.";
  if (isGoodRecord && isBelowMedianPoints)
    return "Winning games, but the numbers suggest danger ahead.";
  if (isWeakRecord && isAboveMedianPoints && isUnlucky)
    return "Better than the record suggests.";
  if (isHotRecent && recentFormAverage > averagePoints)
    return "Heating up at the right time.";
  if (isGoodRecord && isLucky) return "Record looks better than the underlying numbers.";
  if (isWeakRecord && isHighScoring)
    return "Points are there; wins will come if the schedule softens.";
  if (isStrongRecord) return "Winning cures everything.";
  if (isUnlucky && isGoodRecord)
    return "Tough breaks so far. The math likes them more than the standings.";
  if (isLucky) return "Riding a friendly schedule. Regression watch.";
  if (isWeakRecord) return "Needs a run to get back in the mix.";
  return "Middle of the pack. Nothing wrong with that.";
}

/**
 * Generate power rankings from an array of teams.
 */
export function generatePowerRankings(
  teams: PowerRankingsTeamInput[],
  previousRankings: PreviousRanking[] = [],
): PowerRankingRow[] {
  if (!teams?.length) return [];

  const enriched = teams.map((t) => enrichTeam(t, teams));
  const pointsValues = enriched.map((t) => t.averagePoints).filter((n) => typeof n === "number");
  const recentValues = enriched
    .map((t) => t.recentFormAverage)
    .filter((n) => typeof n === "number");
  const luckValues = enriched.map((t) => t.luckDelta);

  const pointsMin = Math.min(...pointsValues, 0);
  const pointsMax = Math.max(...pointsValues, 1);
  const recentMin = Math.min(...recentValues, 0);
  const recentMax = Math.max(...recentValues, 1);
  const luckMin = Math.min(...luckValues);
  const luckMax = Math.max(...luckValues);

  const sorted = [...pointsValues].sort((a, b) => a - b);
  const medianPoints = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : null;
  const recentSorted = [...recentValues].sort((a, b) => a - b);
  const recentFormMedian = recentSorted.length
    ? recentSorted[Math.floor(recentSorted.length / 2)]!
    : null;
  const avgPointsLeague =
    pointsValues.length > 0
      ? pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length
      : null;

  const leagueStats: LeagueStats = {
    avgPointsLeague,
    medianPoints,
    recentFormMedian,
  };

  const withScore = enriched.map((t) => ({
    ...t,
    powerScore: computePowerScore(
      t,
      pointsMin,
      pointsMax,
      recentMin,
      recentMax,
      luckMin,
      luckMax,
    ),
  }));

  withScore.sort((a, b) => b.powerScore - a.powerScore);

  return withScore.map((t, i) => {
    const rank = i + 1;
    const ties = t.ties ?? 0;
    return {
      rank,
      teamId: t.teamId,
      teamName: t.teamName,
      record: formatTeamRecord(t.wins, t.losses, ties),
      powerScore: t.powerScore,
      trend: getTrend(t.teamId, rank, previousRankings),
      commentary: getCommentary(t, leagueStats),
      wins: t.wins,
      losses: t.losses,
      ties,
      pointsFor: t.pointsFor,
      winPct: t.winPct,
      averagePoints: Math.round(t.averagePoints * 10) / 10,
      recentFormAverage: Math.round(t.recentFormAverage * 10) / 10,
      expectedWins: t.expectedWins,
      luckDelta: t.luckDelta,
    };
  });
}

/**
 * Plain-English explanation of why a team has its power score.
 */
export function explainPowerScore(team: Partial<PowerRankingRow> | null): string {
  if (!team) return "No team data provided.";
  const {
    powerScore,
    wins = 0,
    losses = 0,
    ties = 0,
    averagePoints,
    recentFormAverage,
    luckDelta,
    winPct,
  } = team;
  const games = wins + losses + ties;
  const wp = games > 0 ? (wins + 0.5 * ties) / games : winPct ?? 0;
  const parts: string[] = [];
  parts.push(`Power score: ${powerScore} out of 100.`);
  const winDesc = wp >= 0.65 ? "Strong" : wp >= 0.5 ? "Solid" : "Weak";
  parts.push(`${winDesc} win percentage (40% of the score).`);
  if (typeof averagePoints === "number")
    parts.push(`Season scoring average: ${averagePoints.toFixed(1)} points (30% weight).`);
  if (typeof recentFormAverage === "number")
    parts.push(
      `Recent form (last 3 weeks): ${recentFormAverage.toFixed(1)} avg (20% weight).`,
    );
  if (typeof luckDelta === "number") {
    if (luckDelta < -0.2)
      parts.push(
        `Slightly unlucky so far (${luckDelta} wins vs expected); gets a small boost in the formula (10%).`,
      );
    else if (luckDelta > 0.2)
      parts.push(
        `A bit lucky in the schedule (${luckDelta} wins above expected); small penalty applied (10%).`,
      );
    else parts.push("Luck adjustment is neutral (10% of score).");
  }
  return parts.join(" ");
}
