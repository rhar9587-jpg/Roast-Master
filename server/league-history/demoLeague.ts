/**
 * Demo league API adapters — Group Chat Dynasty.
 *
 * All metrics derive from the canonical demo fixture + production engines.
 * Do not hardcode weekly scores, ranking rows, or invented team names here.
 */

import { generatePowerRankings } from "../lib/powerRankings";
import { buildWeeklyRoastNarrative } from "../lib/weeklyRoastEngine";
import {
  buildTeamsFromMatchupData,
  buildWeekMatchups,
  buildIntroSummary,
  buildRoastCalloutsFromNarrative,
  pickVillainFromMatchups,
  pickFraud,
  computeWeeklySuperlatives,
  computeLeagueAverages,
  computeSeasonRaces,
} from "../lib/weeklyCommissioner";
import { buildSeasonOutcomes } from "../lib/domain/seasonOutcome";
import { classifyWeekMatchupPairs } from "../lib/domain/classifyWeekMatchups";
import {
  DEMO_LEAGUE_ID,
  DEMO_LEAGUE_NAME,
  DEMO_SEASONS,
  DEMO_SEASON_RANGE_LABEL,
  DEMO_MANAGERS,
  DEMO_H2H_SEED,
  DEMO_MANAGER_BY_KEY,
  DEMO_MANAGER_BY_ROSTER,
  DEMO_ICONIC_WEEK,
  DEMO_ICONIC_SEASON,
  DEMO_REGULAR_SEASON_END,
  DEMO_PLAYOFF_START,
  DEMO_PLAYOFF_END,
  DEMO_PLAYOFF_TEAMS,
  DEMO_2024_WINNERS_BRACKET,
  DEMO_2024_LOSERS_BRACKET,
  getCanonicalWeeklyMatchups,
  getSleeperMatchupsForDemoWeek,
  getDemoMatchupsByWeek,
  getDemoRosters,
  getDemoUsers,
  getRegularSeasonWeeklyMatchups,
  deriveDemoSeasonStats,
  managerRecordFromWeekly,
  h2hTotalsForManager,
  isCanonicalDemoTeamName,
  type DemoWeeklyMatchupRow,
} from "./demo/canonicalDemoFixture";

export { DEMO_LEAGUE_ID, isCanonicalDemoTeamName };

type Badge = "OWNED" | "NEMESIS" | "RIVAL" | "EDGE" | "SMALL SAMPLE";

interface DominanceRecord {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
  score: number;
  badge: Badge;
}

interface GridCell {
  opponent_key: string;
  opponent_name: string;
  record: DominanceRecord;
  display: { record: string; score: string };
}

interface GridRow {
  key: string;
  name: string;
  opponents: GridCell[];
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalGames: number;
  totalPF: number;
  totalPA: number;
  totalScore: number;
}

const EMOJI_BY_KEY = new Map(DEMO_MANAGERS.map((m) => [m.key, m.emoji]));

function computeBadge(wins: number, losses: number, games: number, score: number): Badge {
  if (wins >= 3 && losses === 0) return "OWNED";
  if (wins === 0 && losses >= 3) return "NEMESIS";
  if (games < 4) return "SMALL SAMPLE";
  if (games >= 5 && Math.abs(score) <= 0.2) return "RIVAL";
  if (wins === 3 && losses === 1) return "EDGE";
  if (wins === 1 && losses === 3) return "EDGE";
  if (wins === 2 && losses === 0) return "EDGE";
  if (wins === 0 && losses === 2) return "EDGE";
  if (score >= 0.5) return "OWNED";
  if (score <= -0.5) return "NEMESIS";
  if (Math.abs(score) <= 0.2) return "RIVAL";
  return "EDGE";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildGrid(): GridRow[] {
  const rows: GridRow[] = [];

  for (const manager of DEMO_MANAGERS) {
    const opponents: GridCell[] = [];
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;
    let totalPF = 0;
    let totalPA = 0;

    for (const opp of DEMO_MANAGERS) {
      if (opp.key === manager.key) continue;
      const h2h = DEMO_H2H_SEED[manager.key]?.[opp.key] || [0, 0, 0, 0];
      const [wins, losses, pf, pa] = h2h;
      const ties = 0;
      const games = wins + losses + ties;
      const score = games > 0 ? (wins - losses) / games : 0;
      const badge = computeBadge(wins, losses, games, score);
      const s2 = round2(score);

      opponents.push({
        opponent_key: opp.key,
        opponent_name: opp.name,
        record: {
          wins,
          losses,
          ties,
          pointsFor: pf,
          pointsAgainst: pa,
          games,
          score: round2(score),
          badge,
        },
        display: {
          record: `${wins}–${losses}`,
          score: `${s2 >= 0 ? "+" : ""}${s2.toFixed(2)}`,
        },
      });

      totalWins += wins;
      totalLosses += losses;
      totalTies += ties;
      totalPF += pf;
      totalPA += pa;
    }

    const totalGames = totalWins + totalLosses + totalTies;
    rows.push({
      key: manager.key,
      name: manager.name,
      opponents,
      totalWins,
      totalLosses,
      totalTies,
      totalGames,
      totalPF: round2(totalPF),
      totalPA: round2(totalPA),
      totalScore: round2(totalGames > 0 ? (totalWins - totalLosses) / totalGames : 0),
    });
  }

  rows.sort((a, b) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.totalScore - a.totalScore;
  });

  const order = new Map(rows.map((r, i) => [r.key, i]));
  for (const r of rows) {
    r.opponents.sort(
      (x, y) => (order.get(x.opponent_key) ?? 999) - (order.get(y.opponent_key) ?? 999),
    );
  }
  return rows;
}

function buildCells(grid: GridRow[]) {
  return grid.flatMap((row) =>
    row.opponents.map((opp) => ({
      a: row.key,
      b: opp.opponent_key,
      aName: row.name,
      bName: opp.opponent_name,
      games: opp.record.games,
      score: opp.record.score,
      badge: opp.record.badge,
      record: opp.display.record,
      pf: opp.record.pointsFor,
      pa: opp.record.pointsAgainst,
    })),
  );
}

function buildTotalsByManager(grid: GridRow[]) {
  return grid.map((r) => ({
    key: r.key,
    name: r.name,
    avatarUrl: null as string | null,
    emoji: EMOJI_BY_KEY.get(r.key) || null,
    totalWins: r.totalWins,
    totalLosses: r.totalLosses,
    totalTies: r.totalTies,
    totalGames: r.totalGames,
    totalPF: r.totalPF,
    totalPA: r.totalPA,
    totalScore: r.totalScore,
  }));
}

function buildDemoSeasonOutcomesFor2024() {
  const weekly = getRegularSeasonWeeklyMatchups("2024");
  const standings = DEMO_MANAGERS.map((m) => {
    const rec = managerRecordFromWeekly(m.key, weekly);
    const pf = weekly
      .filter((row) => row.managerKey === m.key)
      .reduce((s, row) => s + row.points, 0);
    return {
      rosterId: m.rosterId,
      wins: rec.wins,
      losses: rec.losses,
      ties: rec.ties,
      pointsFor: pf,
    };
  });

  return buildSeasonOutcomes({
    season: "2024",
    rosterIds: DEMO_MANAGERS.map((m) => m.rosterId),
    regularSeasonStandings: standings,
    playoffTeams: DEMO_PLAYOFF_TEAMS,
    winnersBracket: DEMO_2024_WINNERS_BRACKET,
    losersBracket: DEMO_2024_LOSERS_BRACKET,
    losersBracketStatus: "available",
  });
}

function getSeasonStatsWithOutcomes() {
  const outcomes2024 = buildDemoSeasonOutcomesFor2024();
  const byRoster = new Map(
    outcomes2024.map((o) => [
      o.rosterId,
      {
        championshipWon: o.championshipWon,
        runnerUp: o.runnerUp,
        lastPlace: o.lastPlace,
        finalFinish: o.finalFinish,
        playoffQualified: o.playoffQualified,
        regularSeasonRank: o.regularSeasonRank,
      },
    ]),
  );
  const outcomesBySeason = new Map([["2024", byRoster]]);
  return deriveDemoSeasonStats({ outcomesBySeason });
}

export function getDemoLeagueData() {
  // Expand weekly first so DEMO_H2H_SEED PF/PA are synced before the grid reads them.
  const weeklyMatchups = getCanonicalWeeklyMatchups();
  const grid = buildGrid();
  const seasonStats = getSeasonStatsWithOutcomes();

  return {
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: DEMO_LEAGUE_NAME,
      season: DEMO_SEASON_RANGE_LABEL,
    },
    history: {
      league_ids: [DEMO_LEAGUE_ID],
      seasons: [...DEMO_SEASONS].reverse(),
      count: DEMO_SEASONS.length,
    },
    grid,
    cells: buildCells(grid),
    totalsByManager: buildTotalsByManager(grid),
    seasonStats,
    weeklyMatchups,
    defaultRegularSeasonEnd: DEMO_REGULAR_SEASON_END,
    playoffStartBySeason: Object.fromEntries(
      DEMO_SEASONS.map((s) => [s, DEMO_PLAYOFF_START]),
    ),
  };
}

export function getDemoLeagueTeams() {
  return {
    league_id: DEMO_LEAGUE_ID,
    teams: DEMO_MANAGERS.map((m) => ({
      roster_id: m.rosterId,
      name: m.name,
    })),
  };
}

function managerName(key: string): string {
  return DEMO_MANAGER_BY_KEY.get(key)?.name ?? key;
}

function formatPts(n: number): string {
  return n.toFixed(1);
}

function rosterName(rid: number): string {
  return DEMO_MANAGER_BY_ROSTER.get(rid)?.name ?? `Team ${rid}`;
}

/** Shared demo power-ranking inputs for a season through `week`. */
export function getDemoPowerRankingInputs(season: string, throughWeek: number) {
  const matchupsByWeek = getDemoMatchupsByWeek(season, throughWeek);
  return buildTeamsFromMatchupData({
    leagueName: DEMO_LEAGUE_NAME,
    throughWeek,
    rosters: getDemoRosters().map((r) => ({
      roster_id: r.roster_id,
      owner_id: r.owner_id,
    })),
    users: getDemoUsers(),
    matchupsByWeek,
    finalThroughWeek: throughWeek,
  });
}

export async function getDemoWeeklyRoast(params: { week?: number; roster_id?: number }) {
  const week = params.week ?? DEMO_ICONIC_WEEK;
  const matchups = getSleeperMatchupsForDemoWeek(DEMO_ICONIC_SEASON, week);
  const narrative = await buildWeeklyRoastNarrative({
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: DEMO_LEAGUE_NAME,
      season: DEMO_ICONIC_SEASON,
    },
    week,
    matchups,
    rosterName,
    weekIsFinal: true,
  });

  // Omit player-level cards that require starter/bench fixture data.
  const cards = narrative.cards.filter(
    (c) => c.type !== "carry_job" && c.type !== "worst_coach",
  );

  const payload: Record<string, unknown> = {
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: DEMO_LEAGUE_NAME,
      season: DEMO_ICONIC_SEASON,
    },
    week,
    headline: narrative.headline,
    stats: narrative.stats,
    cards,
    groupChatSummary: narrative.groupChatSummary,
    signals: { ...narrative.signals, demo: true },
    mode: "DEMO" as const,
    fallback_reason: null,
  };

  if (typeof params.roster_id === "number") {
    const mgr = DEMO_MANAGER_BY_ROSTER.get(params.roster_id);
    if (mgr) {
      const yourRow = matchups.find((m) => m.roster_id === params.roster_id);
      const opp = matchups.find(
        (m) => m.matchup_id === yourRow?.matchup_id && m.roster_id !== params.roster_id,
      );
      if (yourRow && opp) {
        const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal: true });
        const pair = pairs.find((p) => p.matchupId === yourRow.matchup_id);
        let result: "WIN" | "LOSS" | "TIE" = "TIE";
        if (pair?.classification.status === "completed") {
          result =
            pair.classification.winner.rosterId === params.roster_id ? "WIN" : "LOSS";
        } else if (pair?.classification.status === "tie") {
          result = "TIE";
        }
        payload.matchup = {
          roster_id: params.roster_id,
          opponent_roster_id: opp.roster_id,
          you: { username: mgr.name, score: yourRow.points },
          opponent: {
            username: rosterName(opp.roster_id),
            score: opp.points,
          },
          result,
        };
      }
    }
  }

  return payload;
}

export function getDemoWrapped(params: { roster_id?: number }) {
  const rosterId = params.roster_id ?? 1;
  const mgr = DEMO_MANAGER_BY_ROSTER.get(rosterId) ?? DEMO_MANAGERS[0]!;
  const season = DEMO_ICONIC_SEASON;
  const seasonRows = getRegularSeasonWeeklyMatchups(season);
  const managerMatchups = seasonRows.filter((m) => m.managerKey === mgr.key);
  const rec = managerRecordFromWeekly(mgr.key, seasonRows);
  const pointsFor = managerMatchups.reduce((s, m) => s + m.points, 0);
  const pointsAgainst = managerMatchups.reduce((s, m) => s + m.opponentPoints, 0);
  const seasonStats = getSeasonStatsWithOutcomes().filter((s) => s.season === season);
  const seasonStat = seasonStats.find((s) => s.managerKey === mgr.key);
  const rank = seasonStat?.regularSeasonRank ?? seasonStat?.rank ?? 0;
  const record = `${rec.wins}-${rec.losses}${rec.ties ? `-${rec.ties}` : ""}`;

  const winMatchups = managerMatchups.filter((m) => m.won);
  const bestWin = winMatchups.reduce<DemoWeeklyMatchupRow | null>(
    (best, m) => (!best || m.margin > best.margin ? m : best),
    null,
  );

  const recordVsOpp = new Map<string, { wins: number; losses: number }>();
  for (const m of managerMatchups) {
    const r = recordVsOpp.get(m.opponentKey) || { wins: 0, losses: 0 };
    if (m.won) r.wins++;
    else if (m.points !== m.opponentPoints) r.losses++;
    recordVsOpp.set(m.opponentKey, r);
  }
  let worstEnemy: { key: string; theirWins: number; theirLosses: number } | null = null;
  for (const [oppKey, r] of recordVsOpp) {
    const theirWins = r.losses;
    const theirLosses = r.wins;
    if (!worstEnemy || theirWins > worstEnemy.theirWins) {
      worstEnemy = { key: oppKey, theirWins, theirLosses };
    }
  }

  const outcome = seasonStat;
  const cards: unknown[] = [
    {
      type: "season_record",
      title: "YOUR SEASON",
      subtitle: `${mgr.name} finished #${rank}`,
      tagline: outcome?.championshipWon
        ? "Champion. The group chat can cope."
        : "The numbers don't lie.",
      stat: record,
      meta: {
        roster_id: rosterId,
        rank,
        record,
        points_for: Math.round(pointsFor),
        points_against: Math.round(pointsAgainst),
        championshipWon: outcome?.championshipWon ?? false,
        runnerUp: outcome?.runnerUp ?? false,
      },
    },
  ];

  if (bestWin) {
    cards.push({
      type: "best_win",
      title: "STATEMENT WIN",
      subtitle: `Week ${bestWin.week} vs ${managerName(bestWin.opponentKey)}`,
      tagline: "This one felt good.",
      stat: `+${formatPts(bestWin.margin)}`,
      meta: {
        week: bestWin.week,
        points: bestWin.points,
        opponent: managerName(bestWin.opponentKey),
        opponent_points: bestWin.opponentPoints,
      },
    });
  }

  if (worstEnemy) {
    cards.push({
      type: "worst_enemy",
      title: "PUBLIC ENEMY",
      subtitle: managerName(worstEnemy.key),
      tagline: "They had your number.",
      stat: `${worstEnemy.theirWins}-${worstEnemy.theirLosses}`,
      meta: {
        opponent: managerName(worstEnemy.key),
        their_wins: worstEnemy.theirWins,
        their_losses: worstEnemy.theirLosses,
      },
    });
  }

  const chokes = managerMatchups
    .filter((m) => !m.won && m.points > 120)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
  if (chokes.length) {
    cards.push({
      type: "choke_reel",
      title: "CHOKE REEL",
      subtitle: `${chokes.length} high-scoring losses`,
      tagline: "Points don't always equal wins.",
      stat: String(chokes.length),
      meta: {
        count: chokes.length,
        nuclearCount: chokes.filter((c) => c.points > 130).length,
        games: chokes.map((g) => ({
          week: g.week,
          you: g.points,
          opp: g.opponentPoints,
          opponent: managerName(g.opponentKey),
          isNuclear: g.points > 130,
        })),
      },
    });
  }

  return {
    league_id: DEMO_LEAGUE_ID,
    roster_id: rosterId,
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: DEMO_LEAGUE_NAME,
      season,
    },
    wrapped: {
      season: {
        record,
        rank,
        points_for: Math.round(pointsFor),
        points_against: Math.round(pointsAgainst),
      },
      cards,
    },
    mode: "DEMO" as const,
    fallback_reason: null,
  };
}

export function getDemoAutopsy() {
  const season = DEMO_ICONIC_SEASON;
  const seasonRows = getRegularSeasonWeeklyMatchups(season);
  const seasonStats = getSeasonStatsWithOutcomes().filter((s) => s.season === season);

  const lastPlaceStat =
    seasonStats.find((s) => s.lastPlace === true) ||
    [...seasonStats].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
  const lastPlaceName = lastPlaceStat ? managerName(lastPlaceStat.managerKey) : "—";
  const lastPlaceRecord = lastPlaceStat
    ? `${lastPlaceStat.wins}-${lastPlaceStat.losses}`
    : "—";
  const lastPlaceRosterId = lastPlaceStat
    ? DEMO_MANAGER_BY_KEY.get(lastPlaceStat.managerKey)?.rosterId ?? 0
    : 0;

  const seasonHigh = seasonRows.reduce<DemoWeeklyMatchupRow | null>(
    (best, m) => (!best || m.points > best.points ? m : best),
    null,
  );
  const seasonLow = seasonRows.reduce<DemoWeeklyMatchupRow | null>(
    (best, m) => (!best || m.points < best.points ? m : best),
    null,
  );
  const biggestBlowout = seasonRows
    .filter((m) => m.won)
    .reduce<DemoWeeklyMatchupRow | null>(
      (best, m) => (!best || m.margin > best.margin ? m : best),
      null,
    );
  const highestLoss = seasonRows
    .filter((m) => !m.won && m.points !== m.opponentPoints)
    .reduce<DemoWeeklyMatchupRow | null>(
      (best, m) => (!best || m.points > best.points ? m : best),
      null,
    );

  const cards = [
    {
      type: "last_place",
      title: "THE BODY",
      subtitle: `${lastPlaceName} finished #${lastPlaceStat?.rank ?? "—"}`,
      tagline: "Another season, another last place finish.",
      stat: lastPlaceRecord,
      meta: {
        roster_id: lastPlaceRosterId,
        rank: lastPlaceStat?.rank ?? 0,
        record: lastPlaceRecord,
        team: lastPlaceName,
      },
    },
    {
      type: "season_high",
      title: "PEAK DELUSION",
      subtitle: seasonHigh
        ? `${managerName(seasonHigh.managerKey)} in Week ${seasonHigh.week}`
        : "—",
      tagline: "This is what elite looks like.",
      stat: seasonHigh ? formatPts(seasonHigh.points) : "—",
      meta: {
        roster_id: seasonHigh
          ? DEMO_MANAGER_BY_KEY.get(seasonHigh.managerKey)?.rosterId
          : 0,
        week: seasonHigh?.week,
        points: seasonHigh?.points,
        team: seasonHigh ? managerName(seasonHigh.managerKey) : "—",
      },
    },
    {
      type: "season_low",
      title: "CRIME SCENE",
      subtitle: seasonLow
        ? `${managerName(seasonLow.managerKey)} in Week ${seasonLow.week}`
        : "—",
      tagline: "We need to talk about what happened here.",
      stat: seasonLow ? formatPts(seasonLow.points) : "—",
      meta: {
        roster_id: seasonLow
          ? DEMO_MANAGER_BY_KEY.get(seasonLow.managerKey)?.rosterId
          : 0,
        week: seasonLow?.week,
        points: seasonLow?.points,
        team: seasonLow ? managerName(seasonLow.managerKey) : "—",
      },
    },
    {
      type: "biggest_blowout_season",
      title: "MERCY RULE",
      subtitle: biggestBlowout
        ? `${managerName(biggestBlowout.managerKey)} ${formatPts(biggestBlowout.points)} vs ${managerName(biggestBlowout.opponentKey)} ${formatPts(biggestBlowout.opponentPoints)}`
        : "—",
      tagline: "This wasn't a game. It was an execution.",
      stat: biggestBlowout ? `+${formatPts(biggestBlowout.margin)}` : "—",
      meta: {
        week: biggestBlowout?.week,
        winner: biggestBlowout ? managerName(biggestBlowout.managerKey) : "—",
        loser: biggestBlowout ? managerName(biggestBlowout.opponentKey) : "—",
        winner_score: biggestBlowout?.points,
        loser_score: biggestBlowout?.opponentPoints,
        margin: biggestBlowout?.margin,
      },
    },
    {
      type: "highest_loss",
      title: "FANTASY INJUSTICE",
      subtitle: highestLoss
        ? `${managerName(highestLoss.managerKey)} (${formatPts(highestLoss.points)}) lost to ${managerName(highestLoss.opponentKey)} (${formatPts(highestLoss.opponentPoints)}) in Week ${highestLoss.week}`
        : "—",
      tagline: "Some weeks, the fantasy gods just hate you.",
      stat: highestLoss
        ? `-${formatPts(highestLoss.opponentPoints - highestLoss.points)}`
        : "—",
      meta: {
        roster_id: highestLoss
          ? DEMO_MANAGER_BY_KEY.get(highestLoss.managerKey)?.rosterId
          : 0,
        week: highestLoss?.week,
        points: highestLoss?.points,
        team: highestLoss ? managerName(highestLoss.managerKey) : "—",
        opponent: highestLoss ? managerName(highestLoss.opponentKey) : "—",
        opponent_score: highestLoss?.opponentPoints,
      },
    },
  ];

  return {
    league_id: DEMO_LEAGUE_ID,
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: DEMO_LEAGUE_NAME,
      season,
    },
    cards,
    mode: "DEMO" as const,
  };
}

export interface DemoWeeklyEmailPayload {
  leagueName: string;
  week: number;
  rankings: Array<{
    rank: number;
    teamName: string;
    record: string;
    powerScore: number;
    trend: "up" | "down" | "flat";
    commentary: string;
  }>;
  villainOfTheWeek: { teamName: string; reason: string };
  fraudAlert: { teamName: string; reason: string };
  introSummary: string;
  biggestMovers?: {
    riser?: { teamName: string; change: number };
    faller?: { teamName: string; change: number };
  };
  weekMatchups?: Array<{ teamA: string; scoreA: number; teamB: string; scoreB: number }>;
  commissionerSignoff?: string;
  weeklySuperlatives?: {
    highScore: { teamName: string; points: number; keyPerformers?: string[] };
    lowScore: { teamName: string; points: number };
    worstCoach?: { teamName: string; benchPoints: number; sitStartMiss?: string };
    bestCoach?: { teamName: string; benchPoints: number; note?: string };
    stoleOne?: {
      teamName: string;
      points: number;
      opponentName: string;
      opponentPoints: number;
    };
    gotRobbed?: {
      teamName: string;
      points: number;
      opponentName: string;
      opponentPoints: number;
    };
  };
  roastCallouts?: Array<{ label: string; title: string; line: string }>;
  leagueAverages?: { weekAverage: number; seasonAverage: number };
  seasonRaces?: {
    topScoringPace?: {
      teamName: string;
      totalPoints: number;
      pointsPerGame: number;
    };
    lowestScoringPace?: {
      teamName: string;
      totalPoints: number;
      pointsPerGame: number;
    };
    luckiestByPointsAgainst?: {
      teamName: string;
      totalPointsAgainst: number;
      pointsAgainstPerGame: number;
    };
    unluckiestByPointsAgainst?: {
      teamName: string;
      totalPointsAgainst: number;
      pointsAgainstPerGame: number;
    };
  };
  /** Omitted when player fixture data is insufficient — never invent teams. */
  positionLeaders?: Array<{
    position: string;
    playerName: string;
    avgPoints: number;
    teamName: string;
  }>;
}

export async function getDemoWeeklyEmailPayload(
  week: number,
): Promise<DemoWeeklyEmailPayload> {
  const season = DEMO_ICONIC_SEASON;
  const throughWeek = Math.max(1, week);
  const { leagueName, teams } = getDemoPowerRankingInputs(season, throughWeek);
  const rankings = generatePowerRankings(teams);
  const weekMatchupsRaw = getSleeperMatchupsForDemoWeek(season, week);
  const rosterNameByTeamId = (teamId: string) => {
    const t = teams.find((x) => x.teamId === teamId);
    return t?.teamName ?? rosterName(Number(teamId));
  };

  const villain =
    pickVillainFromMatchups(weekMatchupsRaw, rosterNameByTeamId, true) ?? {
      teamName: rankings[rankings.length - 1]?.teamName ?? "Someone",
      reason: "Keeping the basement warm for now.",
    };
  const fraudAlert = pickFraud(rankings);

  const narrative = weekMatchupsRaw.length
    ? await buildWeeklyRoastNarrative({
        league: {
          league_id: DEMO_LEAGUE_ID,
          name: leagueName,
          season,
        },
        week,
        matchups: weekMatchupsRaw,
        rosterName,
        weekIsFinal: true,
      })
    : null;

  const introSummary = narrative
    ? `${narrative.headline} ${narrative.groupChatSummary}`
    : buildIntroSummary(week, rankings, true);

  const weekMatchups = buildWeekMatchups(weekMatchupsRaw, rosterNameByTeamId);
  const weeklySuperlatives = computeWeeklySuperlatives(
    weekMatchupsRaw,
    rosterNameByTeamId,
    null,
    true,
  );
  // Strip coach cards that need player/bench fixture data.
  if (weeklySuperlatives) {
    delete weeklySuperlatives.worstCoach;
    delete weeklySuperlatives.bestCoach;
    if (weeklySuperlatives.highScore) {
      delete weeklySuperlatives.highScore.keyPerformers;
    }
  }

  const roastCallouts = narrative
    ? buildRoastCalloutsFromNarrative({
        ...narrative,
        cards: narrative.cards.filter(
          (c) => c.type !== "carry_job" && c.type !== "worst_coach",
        ),
      })
    : undefined;

  return {
    leagueName,
    week,
    rankings: rankings.map((r) => ({
      rank: r.rank,
      teamName: r.teamName,
      record: r.record,
      powerScore: r.powerScore,
      trend: r.trend,
      commentary: r.commentary,
    })),
    villainOfTheWeek: villain,
    fraudAlert,
    introSummary,
    ...(weekMatchups.length ? { weekMatchups } : {}),
    commissionerSignoff: "Good luck this week. Keep the group chat toxic.",
    ...(weeklySuperlatives ? { weeklySuperlatives } : {}),
    ...(roastCallouts?.length ? { roastCallouts } : {}),
    ...(computeLeagueAverages(teams, weekMatchupsRaw, true)
      ? { leagueAverages: computeLeagueAverages(teams, weekMatchupsRaw, true) }
      : {}),
    ...(computeSeasonRaces(teams) ? { seasonRaces: computeSeasonRaces(teams) } : {}),
    // positionLeaders intentionally omitted — no canonical player fixture
  };
}

/** Demo weekly preview — rankings/matchup names from canonical fixture only. */
export async function getDemoWeeklyPreviewPayload(week: number) {
  const season = DEMO_ICONIC_SEASON;
  const throughWeek = Math.max(1, week - 1);
  const upcoming = getSleeperMatchupsForDemoWeek(season, week);

  let previewPowerBoard:
    | Array<{
        rank: number;
        teamName: string;
        record: string;
        powerScore: number;
        trend: "up" | "down" | "flat";
      }>
    | undefined;
  let likelyBlowout:
    | { teamA: string; teamB: string; narrative: string }
    | undefined;

  if (week > 1 && throughWeek >= 1) {
    const { teams } = getDemoPowerRankingInputs(season, throughWeek);
    const rankings = generatePowerRankings(teams);
    previewPowerBoard = rankings.slice(0, 5).map((r) => ({
      rank: r.rank,
      teamName: r.teamName,
      record: r.record,
      powerScore: r.powerScore,
      trend: r.trend,
    }));
    if (rankings.length >= 2) {
      const top = rankings[0]!;
      const bottom = rankings[rankings.length - 1]!;
      likelyBlowout = {
        teamA: top.teamName,
        teamB: bottom.teamName,
        narrative: `Biggest power gap this week: ${top.teamName} (rank ${top.rank}) vs ${bottom.teamName} (rank ${bottom.rank}).`,
      };
    }
  }

  const upcomingMatchups: Array<{ teamA: string; teamB: string }> = [];
  const seen = new Set<number>();
  for (const m of upcoming) {
    if (seen.has(m.matchup_id)) continue;
    seen.add(m.matchup_id);
    const a = upcoming.find((x) => x.matchup_id === m.matchup_id)!;
    const b = upcoming.find(
      (x) => x.matchup_id === m.matchup_id && x.roster_id !== a.roster_id,
    );
    if (!b) continue;
    upcomingMatchups.push({
      teamA: rosterName(a.roster_id),
      teamB: rosterName(b.roster_id),
    });
  }

  return {
    leagueName: DEMO_LEAGUE_NAME,
    week,
    introSummary:
      week === 1
        ? "Week 1 is here. No power rankings yet—check back after the first week."
        : `Week ${week} is here. Power-rank odds below — not player projections. Here's what to watch.`,
    mode: "preview" as const,
    ...(week === 1
      ? { previewDisclaimer: "Power-rank odds and blowout/upset picks will appear after Week 1." }
      : {
          previewDisclaimer:
            "Win % is based on power rankings through last week — not player projections.",
        }),
    ...(previewPowerBoard ? { previewPowerBoard } : {}),
    upcomingMatchups,
    ...(likelyBlowout
      ? {
          likelyBlowout,
          upsetOfTheWeek: {
            underdog: likelyBlowout.teamB,
            favorite: likelyBlowout.teamA,
            narrative: `The numbers still give ${likelyBlowout.teamB} a path if ${likelyBlowout.teamA} slips.`,
          },
        }
      : {
          likelyBlowout: {
            teamA: DEMO_MANAGERS[0]!.name,
            teamB: DEMO_MANAGERS[DEMO_MANAGERS.length - 1]!.name,
            narrative: "Matchup slate loads after week 1.",
          },
          upsetOfTheWeek: {
            underdog: DEMO_MANAGERS[DEMO_MANAGERS.length - 1]!.name,
            favorite: DEMO_MANAGERS[0]!.name,
            narrative: "Check back after week 1 for upset odds.",
          },
        }),
  };
}

/** Cross-surface snapshot for tests / invariants. */
export function getDemoWeekScoreboard(week: number, season = DEMO_ICONIC_SEASON) {
  const matchups = getSleeperMatchupsForDemoWeek(season, week);
  const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal: true });
  const scores = new Map<number, number>();
  for (const m of matchups) scores.set(m.roster_id, m.points);

  let high: { rosterId: number; name: string; points: number } | null = null;
  let low: { rosterId: number; name: string; points: number } | null = null;
  for (const [rosterId, points] of scores) {
    if (!high || points > high.points) {
      high = { rosterId, name: rosterName(rosterId), points };
    }
    if (!low || points < low.points) {
      low = { rosterId, name: rosterName(rosterId), points };
    }
  }

  return {
    season,
    week,
    scoresByRosterId: Object.fromEntries(scores),
    scoresByName: Object.fromEntries(
      [...scores].map(([id, pts]) => [rosterName(id), pts]),
    ),
    pairs: pairs.map((p) => ({
      matchupId: p.matchupId,
      status: p.classification.status,
      winnerRosterId:
        p.classification.status === "completed"
          ? p.classification.winner.rosterId
          : null,
    })),
    highScorer: high,
    lowScorer: low,
  };
}

export function getDemoLandlordAllTimeRecord() {
  const fromH2h = h2hTotalsForManager("mgr:landlord");
  const fromWeekly = managerRecordFromWeekly("mgr:landlord");
  return { fromH2h, fromWeekly };
}

export { DEMO_PLAYOFF_END };
