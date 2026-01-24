// server/league-history/index.ts
import { getLeague, getRosters, getUsers, getMatchups } from "./sleeper";

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

/**
 * Badge logic:
 * - SMALL SAMPLE: < 3 games
 * - OWNED / NEMESIS: clean sweep of 3+ games (3–0, 4–0, etc), ties must be 0
 * - RIVAL: >= 6 games and close score (abs <= 0.15)
 * - OWNED / NEMESIS: >= 10 games and score threshold (>= 0.35 / <= -0.35)
 * - OWNED / NEMESIS: >= 6 games and stronger threshold (>= 0.50 / <= -0.50)
 * - Otherwise EDGE
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

  // 1) Small sample
  if (games < 3) {
    badge = "SMALL SAMPLE";
  } else {
    // 2) Clean sweep rule (3–0, 4–0, etc). Ties break the sweep.
    if (ties === 0 && losses === 0 && wins >= 3) {
      badge = "OWNED";
    } else if (ties === 0 && wins === 0 && losses >= 3) {
      badge = "NEMESIS";
    } else {
      // 3) Rivalry (only when sample is decent)
      if (games >= 6 && Math.abs(score) <= 0.15) {
        badge = "RIVAL";
      }
      // 4) Strong signals
      else if (games >= 10) {
        if (score >= 0.35) badge = "OWNED";
        else if (score <= -0.35) badge = "NEMESIS";
        else badge = "EDGE";
      } else if (games >= 6) {
        if (score >= 0.5) badge = "OWNED";
        else if (score <= -0.5) badge = "NEMESIS";
        else badge = "EDGE";
      } else {
        badge = "EDGE";
      }
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
}) {
  const league_id = String(params.league_id || "").trim();
  if (!league_id) throw new Error("league_id is required");

  const start_week = Number(params.start_week ?? 1);
  const end_week = Number(params.end_week ?? 17);

  if (!Number.isFinite(start_week) || start_week < 1) throw new Error("start_week must be >= 1");
  if (!Number.isFinite(end_week) || end_week < start_week) throw new Error("end_week must be >= start_week");

  // ✅ NEW: full history chain (newest -> oldest)
  const chain = await getLeagueChain(league_id, 15);

  // We'll build canonical manager keys across seasons:
  // owner_id is best; fallback is username/display_name (stable enough for most leagues)
  const managerByKey = new Map<string, Manager>();

  // Build matchups across all seasons in chain
  const allWeekMatchups: WeekMatchups[] = [];

  // NOTE: we keep week numbers 1..end_week per season; you can later expand to
  // auto-using playoff_week_end per season if you want.
  const weeks = Array.from({ length: end_week - start_week + 1 }, (_, i) => start_week + i);

  for (const seasonLeague of chain) {
    const [rosters, users] = await Promise.all([getRosters(seasonLeague.league_id), getUsers(seasonLeague.league_id)]);

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


    // Fetch matchups per week for this season league
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
            points: Number(m.points ?? 0),
          };
        })
        .filter(Boolean) as MatchupEntry[];

      if (!mapped.length) continue;

      allWeekMatchups.push({ week: w, matchups: mapped });
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
      season: seasonRange, // ✅ now displays range like "2019–2025" if available
    },
    history: {
      league_ids: chain.map((c) => c.league_id),
      seasons: seasonsCovered,
      count: chain.length,
    },
    grid,
    cells,
    totalsByManager,
  };
}