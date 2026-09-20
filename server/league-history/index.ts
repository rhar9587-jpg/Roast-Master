// server/league-history/index.ts
import { getLeague, getRosters, getUsers, getMatchups, getWinnersBracket, getLosersBracket } from "./sleeper";
import type { SleeperBracketMatchup } from "./sleeper";
import { computeSeasonWeekRange, getPlayoffStartWeek } from "./weekFilter";
import { DEMO_LEAGUE_ID, getDemoLeagueData } from "./demoLeague";
import { isCompletedMatchupPoints } from "../lib/domain/matchupStatus";
import { buildTeamStatesThroughWeek } from "../lib/domain/teamStateThroughWeek";
import { buildSeasonOutcomes, matchupsByWeekForSeasonOutcomes } from "../lib/domain/seasonOutcome";
import type { SeasonOutcome } from "../lib/domain/seasonOutcome";

function nameForRoster(
  roster_id: number,
  rosters: { roster_id: number; owner_id: string | null }[],
  users: { user_id: string; username: string; display_name?: string }[],
) {
  const roster = rosters.find((r) => r.roster_id === roster_id);
  const owner = roster?.owner_id ? users.find((u) => u.user_id === roster.owner_id) : null;
  return owner?.display_name || owner?.username || `Roster ${roster_id}`;
}

interface Manager {
  // canonical across seasons
  key: string; // owner_id preferred; fallback to username/display
  name: string;
  avatarUrl?: string | null; // ✅ add
}

interface MatchupEntry {
  managerKey: string;
  rosterId: number;
  points: number;
  matchup_id: number | null;
}

interface WeekMatchups {
  week: number;
  matchups: MatchupEntry[];
}

type Badge = "OWNED" | "NEMESIS" | "RIVAL" | "EDGE" | "SMALL SAMPLE";

interface DominanceRecord {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
  score: number; // (wins - losses) / games
  badge: Badge;
}

interface GridCell {
  opponent_key: string;
  opponent_name: string;
  record: DominanceRecord;
  display?: { record: string; score: string };
}

interface GridRow {
  key: string;
  name: string;
  opponents: GridCell[];
  totalWins: number;
  totalLosses: number;
  totalTies: number;

  // ✅ totals
  totalGames: number;
  totalPF: number;
  totalPA: number;
  totalScore: number; // wins-losses across all games vs all opponents, normalized by games
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Unplayed Sleeper shells are 0–0; do not count them as games or W/L. Shared domain heuristic. */
function isCompletedMatchupPair(aPoints: number, bPoints: number): boolean {
  return isCompletedMatchupPoints(aPoints, bPoints);
}

/**
 * Badge logic:
 * - SMALL SAMPLE: < 4 games
 * - RIVAL: >= 5 games and close score (abs <= 0.20)
 * - Record-first:
 *   - OWNED: wins >= 3 && losses == 0
 *   - NEMESIS: wins == 0 && losses >= 3
 *   - EDGE: 3–1, 2–0, 1–2
 *   - TOO CLOSE (SMALL SAMPLE): 2–1, 2–2, 1–1
 * - Margin modifier (record.score only):
 *   - SMALL SAMPLE -> EDGE when score >= +1.0
 *   - EDGE -> OWNED when score >= +1.0
 *   - EDGE -> SMALL SAMPLE when score <= -1.0
 */
function computeDominanceExtras(base: {
  wins: number;
  losses: number;
  ties: number;
}): { games: number; score: number; badge: Badge; displayRecord: string; displayScore: string } {
  const wins = base.wins ?? 0;
  const losses = base.losses ?? 0;
  const ties = base.ties ?? 0;

  const games = wins + losses + ties;
  const score = games > 0 ? (wins - losses) / games : 0;

  let badge: Badge = "EDGE";

  // ✅ Perfect records bypass small sample check (3-0 is OWNED, 0-3 is NEMESIS)
  if (wins >= 3 && losses === 0) {
    badge = "OWNED";
  } else if (wins === 0 && losses >= 3) {
    badge = "NEMESIS";
  } else if (games < 4) {
    // Small sample for non-perfect records
    badge = "SMALL SAMPLE";
  } else if (games >= 5 && Math.abs(score) <= 0.20) {
    badge = "RIVAL";
  } else {
    if (wins === 3 && losses === 1) {
      badge = "EDGE";
    } else if (wins === 1 && losses === 3) {
      badge = "EDGE";
    } else if (wins === 2 && losses === 0) {
      badge = "EDGE";
    } else if (wins === 0 && losses === 2) {
      badge = "EDGE";
    } else if (wins === 2 && losses === 1) {
      badge = "SMALL SAMPLE";
    } else if (wins === 1 && losses === 2) {
      badge = "SMALL SAMPLE";
    } else if (wins === 2 && losses === 2) {
      badge = "SMALL SAMPLE";
    } else if (wins === 1 && losses === 1) {
      badge = "SMALL SAMPLE";
    } else {
      badge = "EDGE";
    }

    if (badge === "SMALL SAMPLE" && score >= 1.0) {
      badge = "EDGE";
    } else if (badge === "EDGE" && score >= 1.0) {
      badge = "OWNED";
    } else if (badge === "EDGE" && score <= -1.0) {
      badge = "SMALL SAMPLE";
    }
  }

  const displayRecord = ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
  const s2 = round2(score);
  const displayScore = `${s2 >= 0 ? "+" : ""}${s2.toFixed(2)}`;

  return { games, score, badge, displayRecord, displayScore };
}

/**
 * Walk backwards through previous_league_id to build a season chain.
 * Returns array from newest -> oldest (first element is the input league_id).
 */
async function getLeagueChain(startLeagueId: string, maxDepth = 15) {
  const chain: Array<{ league_id: string; name: string; season?: string; previous_league_id?: string | null }> = [];
  let current = startLeagueId;

  for (let i = 0; i < maxDepth; i++) {
    const league = await getLeague(current);
    chain.push({
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      previous_league_id: (league as any).previous_league_id ?? undefined,
    });

    const prev = (league as any).previous_league_id as string | null | undefined;
    // Sleeper uses "0" or null/undefined to indicate no previous league
    if (!prev || prev === "0") break;
    current = prev;
  }

  return chain;
}

function buildDominanceGrid(managers: Manager[], matchupsByWeek: WeekMatchups[]): GridRow[] {
  // recordMap key: aKey->bKey
  const recordMap = new Map<
    string,
    { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number }
  >();

  const getKey = (a: string, b: string) => `${a}::${b}`;
  const getRecord = (a: string, b: string) => {
    const key = getKey(a, b);
    if (!recordMap.has(key)) {
      recordMap.set(key, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    return recordMap.get(key)!;
  };

    for (const { matchups } of matchupsByWeek) {
      const byMatchupId = new Map<number, MatchupEntry[]>();

      for (const m of matchups) {
        if (m.matchup_id == null) continue;
        if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, []);
        byMatchupId.get(m.matchup_id)!.push(m);
      }

      const matchupPairs = Array.from(byMatchupId.entries());
      for (let i = 0; i < matchupPairs.length; i++) {
        const [, pair] = matchupPairs[i]!;
      if (pair.length !== 2) continue;
      const [a, b] = pair;

      // Skip unplayed future-week shells (both 0) — they inflate ties / sample size
      if (!isCompletedMatchupPair(a.points, b.points)) continue;

      const recA = getRecord(a.managerKey, b.managerKey);
      const recB = getRecord(b.managerKey, a.managerKey);

      recA.pointsFor += a.points;
      recA.pointsAgainst += b.points;

      recB.pointsFor += b.points;
      recB.pointsAgainst += a.points;

      if (a.points > b.points) {
        recA.wins++;
        recB.losses++;
      } else if (b.points > a.points) {
        recB.wins++;
        recA.losses++;
      } else {
        recA.ties++;
        recB.ties++;
      }
    }
  }

  const rows: GridRow[] = managers.map((m) => {
    const opponents: GridCell[] = managers
      .filter((o) => o.key !== m.key)
      .map((o) => {
        const raw = getRecord(m.key, o.key);
        const extras = computeDominanceExtras(raw);

        const record: DominanceRecord = {
          ...raw,
          games: extras.games,
          score: extras.score,
          badge: extras.badge,
        };

        return {
          opponent_key: o.key,
          opponent_name: o.name,
          record,
          display: {
            record: extras.displayRecord,
            score: extras.displayScore,
          },
        };
      });

    const totalWins = opponents.reduce((sum, o) => sum + o.record.wins, 0);
    const totalLosses = opponents.reduce((sum, o) => sum + o.record.losses, 0);
    const totalTies = opponents.reduce((sum, o) => sum + o.record.ties, 0);
    const totalGames = totalWins + totalLosses + totalTies;

    const totalPF = opponents.reduce((sum, o) => sum + o.record.pointsFor, 0);
    const totalPA = opponents.reduce((sum, o) => sum + o.record.pointsAgainst, 0);

    const totalScore = totalGames > 0 ? (totalWins - totalLosses) / totalGames : 0;

    return {
      key: m.key,
      name: m.name,
      opponents,
      totalWins,
      totalLosses,
      totalTies,
      totalGames,
      totalPF,
      totalPA,
      totalScore,
    };
  });

  // ✅ default sort: most wins, then score
  rows.sort((a, b) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.totalScore - a.totalScore;
  });

  // also sort opponents consistently by manager order in `rows` after sorting
  const sortedKeys = rows.map((r) => r.key);
  const order = new Map(sortedKeys.map((k, i) => [k, i]));
  for (const r of rows) {
    r.opponents.sort((x, y) => (order.get(x.opponent_key) ?? 999) - (order.get(y.opponent_key) ?? 999));
  }

  return rows;
}

export async function handleLeagueHistoryDominance(params: {
  league_id: string;
  start_week?: number;
  end_week?: number;
  include_playoffs?: boolean;
}) {
  const league_id = String(params.league_id || "").trim();
  if (!league_id) throw new Error("league_id is required");

  // Demo league intercept - return static fictional data (no Sleeper API call)
  if (league_id === DEMO_LEAGUE_ID) {
    return getDemoLeagueData();
  }

  const start_week = Number(params.start_week ?? 1);
  const end_week = Number(params.end_week ?? 17);
  const include_playoffs = params.include_playoffs ?? false;

  if (!Number.isFinite(start_week) || start_week < 1) throw new Error("start_week must be >= 1");
  if (!Number.isFinite(end_week) || end_week < start_week) throw new Error("end_week must be >= start_week");

  // Full history chain (newest -> oldest)
  const chain = await getLeagueChain(league_id, 15);

  // We'll build canonical manager keys across seasons:
  // owner_id is best; fallback is username/display_name (stable enough for most leagues)
  const managerByKey = new Map<string, Manager>();

  // Build matchups across all seasons in chain
  const allWeekMatchups: WeekMatchups[] = [];
  const seasonDataMap = new Map<string, {
    season: string;
    league_id: string;
    rosters: Awaited<ReturnType<typeof getRosters>>;
    users: Awaited<ReturnType<typeof getUsers>>;
    league: Awaited<ReturnType<typeof getLeague>>;
    rosterToManagerKey: Map<number, { key: string; name: string }>;
    weekMatchups: WeekMatchups[];
    playoffStartWeek: number;
    regularSeasonEnd: number;
  }>();

  // Track playoff info across seasons for metadata
  const playoffStartBySeason: Record<string, number> = {};
  const regularSeasonEndValues: number[] = [];

  for (const seasonLeague of chain) {
    const season = seasonLeague.season || String(new Date().getFullYear());
    const [rosters, users, league] = await Promise.all([
      getRosters(seasonLeague.league_id),
      getUsers(seasonLeague.league_id),
      getLeague(seasonLeague.league_id),
    ]);

    const userById = new Map(users.map((u) => [u.user_id, u]));

    const avatarUrlForOwnerId = (ownerId: string | null | undefined) => {
      if (!ownerId) return null;
      const av = userById.get(ownerId)?.avatar;
      return av ? `https://sleepercdn.com/avatars/${av}` : null;
    };

    // Build a mapping roster_id -> canonical managerKey + display name
    const rosterToManagerKey = new Map<number, { key: string; name: string }>();

    for (const r of rosters) {
      const ownerId = r.owner_id;
      const u = ownerId ? userById.get(ownerId) : undefined;

      const fallbackKey = (u?.username || u?.display_name || `roster:${r.roster_id}`).toLowerCase();
      const key = ownerId ? `owner:${ownerId}` : `name:${fallbackKey}`;

      const name = u?.display_name || u?.username || `Roster ${r.roster_id}`;
      const avatarUrl = avatarUrlForOwnerId(ownerId);

      rosterToManagerKey.set(r.roster_id, { key, name });

      if (!managerByKey.has(key)) {
        managerByKey.set(key, { key, name, avatarUrl });
      } else {
        const existing = managerByKey.get(key)!;
        if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
      }
    }

    // Compute playoff start week for this season BEFORE fetching matchups
    const playoffStartWeek = getPlayoffStartWeek(league?.settings as any);
    const regularSeasonEnd = Math.max(1, playoffStartWeek - 1);
    
    // Track for metadata
    playoffStartBySeason[season] = playoffStartWeek;
    regularSeasonEndValues.push(regularSeasonEnd);

    // Store season data for later processing
    seasonDataMap.set(season, {
      season,
      league_id: seasonLeague.league_id,
      rosters,
      users,
      league,
      rosterToManagerKey,
      weekMatchups: [], // Will be populated as we process weeks
      playoffStartWeek,
      regularSeasonEnd,
    });

    // Compute effective week range for this season (respects include_playoffs)
    const weekRange = computeSeasonWeekRange({
      requestedStart: start_week,
      requestedEnd: end_week,
      playoffStartWeek,
      includePlayoffs: include_playoffs,
    });

    // If no valid weeks for this season (e.g., user requested only playoff weeks but include_playoffs=false)
    if (!weekRange) {
      continue;
    }

    // Fetch matchups for the computed week range
    const weeks = Array.from(
      { length: weekRange.end - weekRange.start + 1 },
      (_, i) => weekRange.start + i
    );

    for (const w of weeks) {
      let raw: Array<{ matchup_id: number; roster_id: number; points: number }> = [];
      try {
        raw = await getMatchups(seasonLeague.league_id, w);
      } catch {
        raw = [];
      }
      if (!raw?.length) continue;

      const mapped: MatchupEntry[] = raw
        .map((m) => {
          const mk = rosterToManagerKey.get(m.roster_id);
          if (!mk) return null;
          return {
            matchup_id: m.matchup_id ?? null,
            managerKey: mk.key,
            rosterId: m.roster_id,
            points: Number(m.points ?? 0),
          };
        })
        .filter(Boolean) as MatchupEntry[];

      if (!mapped.length) continue;

      const weekMatchup: WeekMatchups = { week: w, matchups: mapped };
      allWeekMatchups.push(weekMatchup);
      
      // Track this week's matchup for this season
      const seasonData = seasonDataMap.get(season);
      if (seasonData) {
        seasonData.weekMatchups.push(weekMatchup);
      }
    }
  }

  // Compute default regular season end (minimum across all seasons)
  const defaultRegularSeasonEnd = regularSeasonEndValues.length > 0
    ? Math.min(...regularSeasonEndValues)
    : 14; // Fallback if no seasons found

  // Compute seasonStats and weeklyMatchups from stored season data
  const seasonStats: Array<{
    season: string;
    managerKey: string;
    /** @deprecated Prefer regularSeasonRank — kept for older clients as regular-season rank. */
    rank: number;
    wins: number;
    losses: number;
    totalPF: number;
    playoffQualified: boolean;
    playoffTeams: number;
    playoffQualifiedInferred?: boolean;
    playoffStartWeek?: number;
    playoffWeekEnd?: number;
    regularSeasonRank?: number;
    playoffSeed?: number;
    finalFinish?: number;
    championshipWon?: boolean;
    runnerUp?: boolean;
    lastPlace?: boolean;
    outcomeSource?: SeasonOutcome["source"];
  }> = [];
  const weeklyMatchups: Array<{
    season: string;
    week: number;
    managerKey: string;
    opponentKey: string;
    points: number;
    opponentPoints: number;
    margin: number;
    won: boolean;
  }> = [];

  for (const [season, seasonData] of seasonDataMap) {
    const { league, rosters, rosterToManagerKey, weekMatchups, playoffStartWeek, regularSeasonEnd, league_id: seasonLeagueId } =
      seasonData;

    const playoffTeams = league?.settings?.playoff_teams;
    const playoffWeekEnd = league?.settings?.playoff_week_end;

    // Fetch brackets — distinguish failed fetch (unavailable) from known empty [].
    let winnersBracket: SleeperBracketMatchup[] | null = null;
    let losersBracket: SleeperBracketMatchup[] | null = null;
    let losersBracketStatus: "available" | "unavailable" = "unavailable";
    try {
      winnersBracket = await getWinnersBracket(seasonLeagueId);
    } catch {
      winnersBracket = null;
    }
    try {
      losersBracket = await getLosersBracket(seasonLeagueId);
      losersBracketStatus = "available";
    } catch {
      losersBracket = null;
      losersBracketStatus = "unavailable";
    }

    // Season outcomes always use the FULL regular season (1..regularSeasonEnd),
    // independent of the History display filter stored on seasonData.weekMatchups.
    const regularSeasonWeekMatchups: WeekMatchups[] = [];
    const displayByWeek = new Map(weekMatchups.map((w) => [w.week, w]));
    for (let w = 1; w <= regularSeasonEnd; w++) {
      const cached = displayByWeek.get(w);
      if (cached) {
        regularSeasonWeekMatchups.push(cached);
        continue;
      }
      let raw: Array<{ matchup_id: number; roster_id: number; points: number }> = [];
      try {
        raw = await getMatchups(seasonLeagueId, w);
      } catch {
        raw = [];
      }
      if (!raw?.length) continue;
      const mapped: MatchupEntry[] = raw
        .map((m) => {
          const mk = rosterToManagerKey.get(m.roster_id);
          if (!mk) return null;
          return {
            matchup_id: m.matchup_id ?? null,
            managerKey: mk.key,
            rosterId: m.roster_id,
            points: Number(m.points ?? 0),
          };
        })
        .filter(Boolean) as MatchupEntry[];
      if (!mapped.length) continue;
      regularSeasonWeekMatchups.push({ week: w, matchups: mapped });
    }

    const matchupsByWeek = matchupsByWeekForSeasonOutcomes({
      regularSeasonEnd,
      regularSeasonWeekMatchups,
    });

    const identities = rosters.map((r) => {
      const mk = rosterToManagerKey.get(r.roster_id);
      return {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        displayName: mk?.name ?? `Roster ${r.roster_id}`,
      };
    });

    const teamStates = buildTeamStatesThroughWeek({
      throughWeek: regularSeasonEnd,
      identities,
      matchupsByWeek,
    });
    const teamStateByRoster = new Map(teamStates.map((t) => [t.rosterId, t]));

    const regularSeasonStandings = teamStates.map((t) => ({
      rosterId: t.rosterId,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      pointsFor: t.pointsFor,
    }));

    // Total PF for hero cards: prefer full regular-season weeks when available
    const totalPFByManager = new Map<string, number>();
    for (const weekData of regularSeasonWeekMatchups) {
      for (const m of weekData.matchups) {
        const current = totalPFByManager.get(m.managerKey) || 0;
        totalPFByManager.set(m.managerKey, current + m.points);
      }
    }

    const outcomes = buildSeasonOutcomes({
      season,
      rosterIds: rosters.map((r) => r.roster_id),
      regularSeasonStandings,
      playoffTeams,
      winnersBracket,
      losersBracket,
      losersBracketStatus,
      leagueSize: rosters.length,
    });
    const outcomeByRoster = new Map(outcomes.map((o) => [o.rosterId, o]));

    const playoffQualifiedInferred =
      playoffTeams === undefined && !(Array.isArray(winnersBracket) && winnersBracket.length > 0);
    if (playoffQualifiedInferred) {
      console.warn(
        `[LeagueHistory] playoff qualification unknown for season ${season} (no playoff_teams, no winners bracket)`,
      );
    }

    for (const r of rosters) {
      const managerKeyData = rosterToManagerKey.get(r.roster_id);
      if (!managerKeyData) continue;

      const outcome = outcomeByRoster.get(r.roster_id);
      const state = teamStateByRoster.get(r.roster_id);
      const wins = state?.wins ?? 0;
      const losses = state?.losses ?? 0;
      const totalPF = totalPFByManager.get(managerKeyData.key) || 0;

      // Never coerce missing rank to 0. Legacy `rank` mirrors regularSeasonRank when known; else -1.
      const regularSeasonRank = outcome?.regularSeasonRank;
      const legacyRank = regularSeasonRank ?? -1;

      seasonStats.push({
        season,
        managerKey: managerKeyData.key,
        rank: legacyRank,
        wins,
        losses,
        totalPF,
        playoffQualified: outcome?.playoffQualified === true,
        playoffTeams: playoffTeams ?? 0,
        playoffQualifiedInferred,
        playoffStartWeek,
        playoffWeekEnd,
        ...(regularSeasonRank != null ? { regularSeasonRank } : {}),
        ...(outcome?.playoffSeed != null ? { playoffSeed: outcome.playoffSeed } : {}),
        ...(outcome?.finalFinish != null ? { finalFinish: outcome.finalFinish } : {}),
        ...(outcome?.championshipWon != null ? { championshipWon: outcome.championshipWon } : {}),
        ...(outcome?.runnerUp != null ? { runnerUp: outcome.runnerUp } : {}),
        ...(outcome?.lastPlace != null ? { lastPlace: outcome.lastPlace } : {}),
        ...(outcome?.source ? { outcomeSource: outcome.source } : {}),
      });
    }

    // Build weeklyMatchups by pairing matchups by matchup_id for this season
    for (const weekData of weekMatchups) {
      const matchupGroups = new Map<number | null, typeof weekData.matchups>();
      for (const m of weekData.matchups) {
        const group = matchupGroups.get(m.matchup_id) || [];
        group.push(m);
        matchupGroups.set(m.matchup_id, group);
      }

      for (const [, entries] of matchupGroups) {
        if (entries.length !== 2) continue;
        const [a, b] = entries;
        if (!isCompletedMatchupPair(a.points, b.points)) continue;
        if (a.points === b.points) continue;

        const margin = Math.abs(a.points - b.points);
        const aWon = a.points > b.points;

        weeklyMatchups.push({
          season,
          week: weekData.week,
          managerKey: a.managerKey,
          opponentKey: b.managerKey,
          points: a.points,
          opponentPoints: b.points,
          margin: aWon ? margin : -margin,
          won: aWon,
        });

        weeklyMatchups.push({
          season,
          week: weekData.week,
          managerKey: b.managerKey,
          opponentKey: a.managerKey,
          points: b.points,
          opponentPoints: a.points,
          margin: aWon ? -margin : margin,
          won: !aWon,
        });
      }
    }
  }

  const managers = Array.from(managerByKey.values());
  const grid = buildDominanceGrid(managers, allWeekMatchups);

  // flattened cells for your UI
  const cells = grid.flatMap((row) =>
    row.opponents.map((opp) => ({
      a: row.key,
      b: opp.opponent_key,
      aName: row.name,
      bName: opp.opponent_name,
      games: opp.record.games,
      score: opp.record.score,
      badge: opp.record.badge,
      record: opp.display?.record ?? `${opp.record.wins}-${opp.record.losses}`,
      pf: opp.record.pointsFor,
      pa: opp.record.pointsAgainst,
    })),
  );

  // expose totals for sorting/leaderboard UI
  const totalsByManager = grid.map((r) => {
    const mgr = managerByKey.get(r.key);
    return {
      key: r.key,
      name: r.name,
      avatarUrl: mgr?.avatarUrl ?? null,
      totalWins: r.totalWins,
      totalLosses: r.totalLosses,
      totalTies: r.totalTies,
      totalGames: r.totalGames,
      totalPF: r.totalPF,
      totalPA: r.totalPA,
      totalScore: r.totalScore,
    };
  });


  // “league” metadata: show newest league name, and include years covered
  const newest = chain[0];
  const seasonsCovered = chain.map((c) => c.season).filter(Boolean) as string[];
  const seasonRange =
    seasonsCovered.length > 0 ? `${seasonsCovered[seasonsCovered.length - 1]}–${seasonsCovered[0]}` : newest.season;

  return {
    league: {
      league_id: newest.league_id,
      name: newest.name,
      season: seasonRange, // displays range like "2019–2025" if available
    },
    history: {
      league_ids: chain.map((c) => c.league_id),
      seasons: seasonsCovered,
      count: chain.length,
    },
    grid,
    cells,
    totalsByManager,
    seasonStats,
    weeklyMatchups,
    // Metadata for playoff filtering
    defaultRegularSeasonEnd,
    playoffStartBySeason,
  };
}