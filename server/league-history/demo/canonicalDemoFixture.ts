/**
 * Canonical demo league fixture — single source of truth for all demo surfaces.
 *
 * Shape mirrors Sleeper inputs enough for production engines (matchups, rosters,
 * users, brackets). Weekly history is expanded from H2H aggregates so League
 * History totals and personal/hero cards share one scope.
 */

export const DEMO_LEAGUE_ID = "demo-group-chat-dynasty";
export const DEMO_LEAGUE_NAME = "Group Chat Dynasty";
export const DEMO_SEASONS = ["2019", "2020", "2021", "2022", "2023", "2024"] as const;
export const DEMO_REGULAR_SEASON_END = 14;

export type DemoManager = {
  key: string;
  name: string;
  emoji: string;
  rosterId: number;
  ownerId: string;
};

export const DEMO_MANAGERS: DemoManager[] = [
  { key: "mgr:landlord", name: "The Landlord", emoji: "👑", rosterId: 1, ownerId: "demo-owner-landlord" },
  { key: "mgr:choker", name: "Playoff Choker", emoji: "😰", rosterId: 2, ownerId: "demo-owner-choker" },
  { key: "mgr:waiver", name: "Waiver Wizard", emoji: "🧙", rosterId: 3, ownerId: "demo-owner-waiver" },
  { key: "mgr:chaos", name: "Commissioner Chaos", emoji: "🌪️", rosterId: 4, ownerId: "demo-owner-chaos" },
  { key: "mgr:sleeper", name: "Sleeper Genius", emoji: "🧠", rosterId: 5, ownerId: "demo-owner-sleeper" },
  { key: "mgr:trade", name: "Trade Bandit", emoji: "🤝", rosterId: 6, ownerId: "demo-owner-trade" },
  { key: "mgr:injury", name: "Injury Magnet", emoji: "🩹", rosterId: 7, ownerId: "demo-owner-injury" },
  { key: "mgr:trash", name: "Trash Talk Titan", emoji: "🗣️", rosterId: 8, ownerId: "demo-owner-trash" },
  { key: "mgr:bye", name: "Bye Week Victim", emoji: "📅", rosterId: 9, ownerId: "demo-owner-bye" },
  { key: "mgr:heartbreak", name: "Heartbreak Hotel", emoji: "💔", rosterId: 10, ownerId: "demo-owner-heartbreak" },
  { key: "mgr:autodraft", name: "Auto-Draft Guy", emoji: "🤖", rosterId: 11, ownerId: "demo-owner-autodraft" },
  { key: "mgr:rebuild", name: "Rebuild Forever", emoji: "🔨", rosterId: 12, ownerId: "demo-owner-rebuild" },
];

export const DEMO_MANAGER_BY_KEY = new Map(DEMO_MANAGERS.map((m) => [m.key, m]));
export const DEMO_MANAGER_BY_ROSTER = new Map(DEMO_MANAGERS.map((m) => [m.rosterId, m]));

/** H2H seed: [wins, losses, pf, pa] for row manager vs column manager. */
export const DEMO_H2H_SEED: Record<string, Record<string, [number, number, number, number]>> = {
  "mgr:landlord": {
    "mgr:choker": [7, 5, 1456.2, 1423.8],
    "mgr:waiver": [6, 6, 1398.4, 1402.1],
    "mgr:chaos": [7, 5, 1445.3, 1389.2],
    "mgr:sleeper": [6, 6, 1412.8, 1398.6],
    "mgr:trade": [8, 4, 1489.2, 1345.7],
    "mgr:injury": [9, 3, 1523.4, 1298.1],
    "mgr:trash": [10, 2, 1567.8, 1234.5],
    "mgr:bye": [8, 2, 1398.2, 1156.3],
    "mgr:heartbreak": [7, 5, 1423.1, 1389.4],
    "mgr:autodraft": [9, 3, 1512.3, 1287.6],
    "mgr:rebuild": [10, 1, 1545.6, 1123.4],
  },
  "mgr:choker": {
    "mgr:landlord": [5, 7, 1423.8, 1456.2],
    "mgr:waiver": [7, 5, 1467.3, 1398.2],
    "mgr:chaos": [6, 6, 1412.4, 1398.7],
    "mgr:sleeper": [7, 5, 1445.2, 1387.9],
    "mgr:trade": [8, 4, 1498.3, 1356.2],
    "mgr:injury": [9, 3, 1534.2, 1289.4],
    "mgr:trash": [8, 4, 1489.5, 1345.8],
    "mgr:bye": [9, 3, 1523.4, 1278.9],
    "mgr:heartbreak": [7, 5, 1456.8, 1398.2],
    "mgr:autodraft": [10, 2, 1567.3, 1234.1],
    "mgr:rebuild": [9, 3, 1534.6, 1287.3],
  },
  "mgr:waiver": {
    "mgr:landlord": [6, 6, 1402.1, 1398.4],
    "mgr:choker": [5, 7, 1398.2, 1467.3],
    "mgr:chaos": [7, 5, 1456.3, 1389.2],
    "mgr:sleeper": [6, 6, 1412.4, 1401.8],
    "mgr:trade": [7, 5, 1467.2, 1378.9],
    "mgr:injury": [8, 4, 1498.3, 1312.4],
    "mgr:trash": [8, 4, 1489.2, 1334.5],
    "mgr:bye": [8, 4, 1478.3, 1298.7],
    "mgr:heartbreak": [7, 5, 1456.2, 1389.4],
    "mgr:autodraft": [9, 3, 1534.8, 1267.3],
    "mgr:rebuild": [8, 4, 1489.4, 1312.6],
  },
  "mgr:chaos": {
    "mgr:landlord": [5, 7, 1389.2, 1445.3],
    "mgr:choker": [6, 6, 1398.7, 1412.4],
    "mgr:waiver": [5, 7, 1389.2, 1456.3],
    "mgr:sleeper": [6, 6, 1401.3, 1398.4],
    "mgr:trade": [6, 6, 1412.5, 1401.2],
    "mgr:injury": [7, 5, 1456.3, 1378.2],
    "mgr:trash": [7, 5, 1456.2, 1378.4],
    "mgr:bye": [8, 4, 1489.3, 1312.5],
    "mgr:heartbreak": [7, 5, 1456.4, 1378.2],
    "mgr:autodraft": [8, 4, 1489.5, 1298.6],
    "mgr:rebuild": [8, 4, 1489.5, 1298.6],
  },
  "mgr:sleeper": {
    "mgr:landlord": [6, 6, 1398.6, 1412.8],
    "mgr:choker": [5, 7, 1387.9, 1445.2],
    "mgr:waiver": [6, 6, 1401.8, 1412.4],
    "mgr:chaos": [6, 6, 1398.4, 1401.3],
    "mgr:trade": [7, 5, 1456.2, 1378.9],
    "mgr:injury": [8, 4, 1498.2, 1312.4],
    "mgr:trash": [7, 5, 1456.3, 1378.5],
    "mgr:bye": [8, 4, 1489.4, 1298.7],
    "mgr:heartbreak": [7, 5, 1456.2, 1378.4],
    "mgr:autodraft": [9, 3, 1534.2, 1267.4],
    "mgr:rebuild": [8, 4, 1498.2, 1298.7],
  },
  "mgr:trade": {
    "mgr:landlord": [4, 8, 1345.7, 1489.2],
    "mgr:choker": [4, 8, 1356.2, 1498.3],
    "mgr:waiver": [5, 7, 1378.9, 1467.2],
    "mgr:chaos": [6, 6, 1401.2, 1412.5],
    "mgr:sleeper": [5, 7, 1378.9, 1456.2],
    "mgr:injury": [6, 6, 1401.4, 1398.7],
    "mgr:trash": [7, 5, 1456.8, 1367.3],
    "mgr:bye": [7, 5, 1456.3, 1378.2],
    "mgr:heartbreak": [6, 6, 1401.3, 1398.7],
    "mgr:autodraft": [8, 4, 1489.3, 1312.4],
    "mgr:rebuild": [7, 5, 1456.8, 1367.3],
  },
  "mgr:injury": {
    "mgr:landlord": [3, 9, 1298.1, 1523.4],
    "mgr:choker": [3, 9, 1289.4, 1534.2],
    "mgr:waiver": [4, 8, 1312.4, 1498.3],
    "mgr:chaos": [5, 7, 1378.2, 1456.3],
    "mgr:sleeper": [4, 8, 1312.4, 1498.2],
    "mgr:trade": [6, 6, 1398.7, 1401.4],
    "mgr:trash": [6, 6, 1401.2, 1398.8],
    "mgr:bye": [6, 6, 1401.3, 1398.7],
    "mgr:heartbreak": [5, 7, 1378.4, 1456.2],
    "mgr:autodraft": [7, 5, 1456.2, 1378.3],
    "mgr:rebuild": [6, 6, 1401.3, 1398.7],
  },
  "mgr:trash": {
    "mgr:landlord": [2, 10, 1234.5, 1567.8],
    "mgr:choker": [4, 8, 1345.8, 1489.5],
    "mgr:waiver": [4, 8, 1334.5, 1489.2],
    "mgr:chaos": [5, 7, 1378.4, 1456.2],
    "mgr:sleeper": [5, 7, 1378.5, 1456.3],
    "mgr:trade": [5, 7, 1367.3, 1456.8],
    "mgr:injury": [6, 6, 1398.8, 1401.2],
    "mgr:bye": [5, 7, 1378.2, 1456.3],
    "mgr:heartbreak": [6, 6, 1401.4, 1398.8],
    "mgr:autodraft": [6, 6, 1401.3, 1398.4],
    "mgr:rebuild": [6, 6, 1401.4, 1398.8],
  },
  "mgr:bye": {
    "mgr:landlord": [2, 8, 1156.3, 1398.2],
    "mgr:choker": [3, 9, 1278.9, 1523.4],
    "mgr:waiver": [4, 8, 1298.7, 1478.3],
    "mgr:chaos": [4, 8, 1312.5, 1489.3],
    "mgr:sleeper": [4, 8, 1298.7, 1489.4],
    "mgr:trade": [5, 7, 1378.2, 1456.3],
    "mgr:injury": [6, 6, 1398.7, 1401.3],
    "mgr:trash": [7, 5, 1456.3, 1378.2],
    "mgr:heartbreak": [5, 7, 1378.3, 1456.2],
    "mgr:autodraft": [6, 6, 1401.3, 1398.4],
    "mgr:rebuild": [5, 7, 1378.3, 1456.4],
  },
  "mgr:heartbreak": {
    "mgr:landlord": [5, 7, 1389.4, 1423.1],
    "mgr:choker": [5, 7, 1398.2, 1456.8],
    "mgr:waiver": [5, 7, 1389.4, 1456.2],
    "mgr:chaos": [5, 7, 1378.2, 1456.4],
    "mgr:sleeper": [5, 7, 1378.4, 1456.2],
    "mgr:trade": [6, 6, 1398.7, 1401.3],
    "mgr:injury": [7, 5, 1456.2, 1378.4],
    "mgr:trash": [6, 6, 1398.8, 1401.4],
    "mgr:bye": [7, 5, 1456.2, 1378.3],
    "mgr:autodraft": [5, 7, 1378.2, 1456.4],
    "mgr:rebuild": [6, 6, 1401.3, 1398.7],
  },
  "mgr:autodraft": {
    "mgr:landlord": [3, 9, 1287.6, 1512.3],
    "mgr:choker": [2, 10, 1234.1, 1567.3],
    "mgr:waiver": [3, 9, 1267.3, 1534.8],
    "mgr:chaos": [4, 8, 1298.6, 1489.5],
    "mgr:sleeper": [3, 9, 1267.4, 1534.2],
    "mgr:trade": [4, 8, 1312.4, 1489.3],
    "mgr:injury": [5, 7, 1378.3, 1456.2],
    "mgr:trash": [6, 6, 1398.4, 1401.3],
    "mgr:bye": [6, 6, 1398.4, 1401.3],
    "mgr:heartbreak": [7, 5, 1456.4, 1378.2],
    "mgr:rebuild": [5, 7, 1378.3, 1456.2],
  },
  "mgr:rebuild": {
    "mgr:landlord": [1, 10, 1123.4, 1545.6],
    "mgr:choker": [3, 9, 1287.3, 1534.6],
    "mgr:waiver": [4, 8, 1312.6, 1489.4],
    "mgr:chaos": [4, 8, 1298.6, 1489.5],
    "mgr:sleeper": [4, 8, 1298.7, 1498.2],
    "mgr:trade": [5, 7, 1367.3, 1456.8],
    "mgr:injury": [6, 6, 1398.7, 1401.3],
    "mgr:trash": [6, 6, 1398.8, 1401.4],
    "mgr:bye": [7, 5, 1456.4, 1378.3],
    "mgr:heartbreak": [6, 6, 1398.7, 1401.3],
    "mgr:autodraft": [7, 5, 1456.2, 1378.3],
  },
};

export type DemoWeeklyMatchupRow = {
  season: string;
  week: number;
  managerKey: string;
  opponentKey: string;
  points: number;
  opponentPoints: number;
  margin: number;
  won: boolean;
};

/** Iconic Week 8 2024 slate — complete 6-game week used by roast + commissioner. */
export const DEMO_ICONIC_WEEK = 8;
export const DEMO_ICONIC_SEASON = "2024";

const ICONIC_WEEK_PAIRS: Array<{
  a: string;
  b: string;
  aPts: number;
  bPts: number;
}> = [
  { a: "mgr:landlord", b: "mgr:rebuild", aPts: 167.4, bPts: 62.1 },
  { a: "mgr:choker", b: "mgr:autodraft", aPts: 132.5, bPts: 98.4 },
  { a: "mgr:waiver", b: "mgr:heartbreak", aPts: 128.9, bPts: 119.2 },
  { a: "mgr:chaos", b: "mgr:bye", aPts: 121.3, bPts: 108.7 },
  { a: "mgr:sleeper", b: "mgr:trash", aPts: 125.6, bPts: 114.8 },
  { a: "mgr:trade", b: "mgr:injury", aPts: 118.2, bPts: 115.9 },
];

function pushPair(
  out: DemoWeeklyMatchupRow[],
  season: string,
  week: number,
  aKey: string,
  bKey: string,
  aPts: number,
  bPts: number,
): void {
  const aWon = aPts > bPts;
  const bWon = bPts > aPts;
  // Ties: neither won
  out.push({
    season,
    week,
    managerKey: aKey,
    opponentKey: bKey,
    points: aPts,
    opponentPoints: bPts,
    margin: aPts - bPts,
    won: aWon,
  });
  out.push({
    season,
    week,
    managerKey: bKey,
    opponentKey: aKey,
    points: bPts,
    opponentPoints: aPts,
    margin: bPts - aPts,
    won: bWon,
  });
}

/**
 * Expand H2H seed into weekly rows. Schedules without double-booking a manager
 * in the same season+week. Iconic week 8 2024 uses the fixed complete slate.
 */
export function buildCanonicalWeeklyMatchups(): DemoWeeklyMatchupRow[] {
  const out: DemoWeeklyMatchupRow[] = [];
  const occupied = new Set<string>(); // `${season}|${week}|${managerKey}`
  const remaining = new Map<string, { winsLeft: number; lossesLeft: number; pf: number; pa: number; games: number }>();

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const a of DEMO_MANAGERS) {
    for (const b of DEMO_MANAGERS) {
      if (a.key >= b.key) continue;
      const seed = DEMO_H2H_SEED[a.key]?.[b.key];
      if (!seed) continue;
      const [wins, losses, pf, pa] = seed;
      remaining.set(pairKey(a.key, b.key), {
        winsLeft: wins,
        lossesLeft: losses,
        pf,
        pa,
        games: wins + losses,
      });
    }
  }

  // Place iconic week first so those H2H results count toward quotas
  for (const pair of ICONIC_WEEK_PAIRS) {
    pushPair(out, DEMO_ICONIC_SEASON, DEMO_ICONIC_WEEK, pair.a, pair.b, pair.aPts, pair.bPts);
    occupied.add(`${DEMO_ICONIC_SEASON}|${DEMO_ICONIC_WEEK}|${pair.a}`);
    occupied.add(`${DEMO_ICONIC_SEASON}|${DEMO_ICONIC_WEEK}|${pair.b}`);
    const pk = pairKey(pair.a, pair.b);
    const rem = remaining.get(pk);
    if (rem) {
      if (pair.aPts > pair.bPts) {
        // a won — if a < b lexicographically, winsLeft is for lower key... 
        // remaining is always stored with a.key < b.key from DEMO_MANAGERS order via pairKey
        const low = pair.a < pair.b ? pair.a : pair.b;
        const lowWon = (pair.a < pair.b ? pair.aPts : pair.bPts) > (pair.a < pair.b ? pair.bPts : pair.aPts);
        if (lowWon) rem.winsLeft = Math.max(0, rem.winsLeft - 1);
        else rem.lossesLeft = Math.max(0, rem.lossesLeft - 1);
      } else if (pair.bPts > pair.aPts) {
        const low = pair.a < pair.b ? pair.a : pair.b;
        const lowWon = false; // higher score is not low when b wins and we need check
        const lowIsA = pair.a < pair.b;
        const lowPts = lowIsA ? pair.aPts : pair.bPts;
        const highPts = lowIsA ? pair.bPts : pair.aPts;
        if (lowPts > highPts) rem.winsLeft = Math.max(0, rem.winsLeft - 1);
        else rem.lossesLeft = Math.max(0, rem.lossesLeft - 1);
      }
    }
  }

  function tryPlace(
    season: string,
    week: number,
    lowKey: string,
    highKey: string,
    lowWins: boolean,
    lowPts: number,
    highPts: number,
  ): boolean {
    const o1 = `${season}|${week}|${lowKey}`;
    const o2 = `${season}|${week}|${highKey}`;
    if (occupied.has(o1) || occupied.has(o2)) return false;
    pushPair(out, season, week, lowKey, highKey, lowPts, highPts);
    occupied.add(o1);
    occupied.add(o2);
    return true;
  }

  // Schedule remaining games across seasons / regular-season weeks only.
  // Overflow uses high week numbers so all-time W/L still matches H2H totals,
  // while season-scoped views (weeks 1..DEMO_REGULAR_SEASON_END) stay clean.
  for (const [pk, rem] of remaining) {
    const [lowKey, highKey] = pk.split("|") as [string, string];
    const games = rem.games || 1;
    const avgLow = rem.pf / games;
    const avgHigh = rem.pa / games;

    while (rem.winsLeft > 0 || rem.lossesLeft > 0) {
      const lowWins = rem.winsLeft > 0;
      if (lowWins) rem.winsLeft--;
      else rem.lossesLeft--;

      const lowPts = round1(lowWins ? Math.max(avgLow, avgHigh + 5) : Math.min(avgLow, avgHigh - 5));
      const highPts = round1(lowWins ? Math.min(avgHigh, avgLow - 5) : Math.max(avgHigh, avgLow + 5));

      let placed = false;
      for (const season of DEMO_SEASONS) {
        for (let week = 1; week <= DEMO_REGULAR_SEASON_END; week++) {
          if (tryPlace(season, week, lowKey, highKey, lowWins, lowPts, highPts)) {
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        const season = DEMO_SEASONS[DEMO_SEASONS.length - 1]!;
        let week = DEMO_REGULAR_SEASON_END + 100; // all-time overflow bucket
        while (!tryPlace(season, week, lowKey, highKey, lowWins, lowPts, highPts)) week++;
      }
    }
  }

  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

let _weeklyCache: DemoWeeklyMatchupRow[] | null = null;

export function getCanonicalWeeklyMatchups(): DemoWeeklyMatchupRow[] {
  if (!_weeklyCache) _weeklyCache = buildCanonicalWeeklyMatchups();
  return _weeklyCache;
}

/** Reset cache (tests). */
export function resetCanonicalWeeklyMatchupsCache(): void {
  _weeklyCache = null;
}

export function getWeeklyMatchupsForSeasonWeek(season: string, week: number): DemoWeeklyMatchupRow[] {
  return getCanonicalWeeklyMatchups().filter((m) => m.season === season && m.week === week);
}

/** Sleeper-shaped matchup rows for a demo week (one row per roster). */
export function getSleeperMatchupsForDemoWeek(season: string, week: number): Array<{
  matchup_id: number;
  roster_id: number;
  points: number;
}> {
  const rows = getWeeklyMatchupsForSeasonWeek(season, week);
  const seen = new Set<string>();
  const out: Array<{ matchup_id: number; roster_id: number; points: number }> = [];
  let matchupId = 1;
  const pairSeen = new Set<string>();

  for (const row of rows) {
    const pk = [row.managerKey, row.opponentKey].sort().join("|");
    if (pairSeen.has(pk)) continue;
    pairSeen.add(pk);
    const a = DEMO_MANAGER_BY_KEY.get(row.managerKey);
    const b = DEMO_MANAGER_BY_KEY.get(row.opponentKey);
    if (!a || !b) continue;
    out.push({ matchup_id: matchupId, roster_id: a.rosterId, points: row.points });
    out.push({ matchup_id: matchupId, roster_id: b.rosterId, points: row.opponentPoints });
    matchupId++;
    seen.add(row.managerKey);
    seen.add(row.opponentKey);
  }
  return out;
}

export function getDemoRosters(): Array<{ roster_id: number; owner_id: string }> {
  return DEMO_MANAGERS.map((m) => ({ roster_id: m.rosterId, owner_id: m.ownerId }));
}

export function getDemoUsers(): Array<{ user_id: string; username: string; display_name: string }> {
  return DEMO_MANAGERS.map((m) => ({
    user_id: m.ownerId,
    username: m.key.replace("mgr:", ""),
    display_name: m.name,
  }));
}

export function isCanonicalDemoTeamName(name: string): boolean {
  return DEMO_MANAGERS.some((m) => m.name === name);
}

export function managerRecordFromWeekly(
  managerKey: string,
  weekly: DemoWeeklyMatchupRow[] = getCanonicalWeeklyMatchups(),
): { wins: number; losses: number; ties: number } {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const seen = new Set<string>();
  for (const m of weekly) {
    if (m.managerKey !== managerKey) continue;
    const id = `${m.season}|${m.week}|${[m.managerKey, m.opponentKey].sort().join("|")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (m.won) wins++;
    else if (m.points === m.opponentPoints) ties++;
    else losses++;
  }
  return { wins, losses, ties };
}

/** 2024 winners bracket: #1 seed choker loses final to #4-ish landlord. */
export const DEMO_2024_WINNERS_BRACKET = [
  { r: 1, m: 1, t1: 3, t2: 6, w: 3, l: 6 },
  { r: 1, m: 2, t1: 4, t2: 5, w: 4, l: 5 },
  { r: 2, m: 3, t1: 1, t2: 3, w: 1, l: 3 },
  { r: 2, m: 4, t1: 2, t2: 4, w: 2, l: 4 },
  { r: 2, m: 5, t1: 6, t2: 5, w: 5, l: 6, p: 5 },
  { r: 3, m: 6, t1: 1, t2: 2, w: 1, l: 2, p: 1 }, // landlord (1) beats choker (2)
  { r: 3, m: 7, t1: 3, t2: 4, w: 3, l: 4, p: 3 },
];

export const DEMO_2024_LOSERS_BRACKET: typeof DEMO_2024_WINNERS_BRACKET = [];

export const DEMO_PLAYOFF_START = 15;
export const DEMO_PLAYOFF_END = 17;
export const DEMO_PLAYOFF_TEAMS = 6;

/** Regular-season weekly rows only (excludes all-time overflow weeks). */
export function getRegularSeasonWeeklyMatchups(
  season?: string,
  weekly: DemoWeeklyMatchupRow[] = getCanonicalWeeklyMatchups(),
): DemoWeeklyMatchupRow[] {
  return weekly.filter(
    (m) =>
      m.week >= 1 &&
      m.week <= DEMO_REGULAR_SEASON_END &&
      (season == null || m.season === season),
  );
}

/** Build Sleeper-shaped matchupsByWeek map for a season through `throughWeek`. */
export function getDemoMatchupsByWeek(
  season: string,
  throughWeek: number,
): Map<number, Array<{ matchup_id: number; roster_id: number; points: number }>> {
  const map = new Map<number, Array<{ matchup_id: number; roster_id: number; points: number }>>();
  for (let w = 1; w <= throughWeek; w++) {
    const rows = getSleeperMatchupsForDemoWeek(season, w);
    if (rows.length) map.set(w, rows);
  }
  return map;
}

export type DemoSeasonStatRow = {
  season: string;
  managerKey: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  totalPF: number;
  playoffQualified: boolean;
  playoffTeams: number;
  playoffStartWeek: number;
  playoffWeekEnd: number;
  regularSeasonRank?: number;
  championshipWon?: boolean;
  runnerUp?: boolean;
  lastPlace?: boolean;
  finalFinish?: number;
};

/**
 * Derive per-season standings from regular-season weekly history, then attach
 * 2024 bracket outcomes via SeasonOutcome fields when provided.
 */
export function deriveDemoSeasonStats(params?: {
  weekly?: DemoWeeklyMatchupRow[];
  outcomesBySeason?: Map<string, Map<number, {
    championshipWon?: boolean;
    runnerUp?: boolean;
    lastPlace?: boolean;
    finalFinish?: number;
    playoffQualified?: boolean;
    regularSeasonRank?: number;
  }>>;
}): DemoSeasonStatRow[] {
  const weekly = params?.weekly ?? getCanonicalWeeklyMatchups();
  const out: DemoSeasonStatRow[] = [];

  for (const season of DEMO_SEASONS) {
    const seasonRows = getRegularSeasonWeeklyMatchups(season, weekly);
    type Agg = { wins: number; losses: number; ties: number; pf: number };
    const byMgr = new Map<string, Agg>();
    for (const m of DEMO_MANAGERS) {
      byMgr.set(m.key, { wins: 0, losses: 0, ties: 0, pf: 0 });
    }
    const seen = new Set<string>();
    for (const row of seasonRows) {
      const id = `${row.week}|${[row.managerKey, row.opponentKey].sort().join("|")}`;
      if (seen.has(`${row.managerKey}|${id}`)) continue;
      seen.add(`${row.managerKey}|${id}`);
      const agg = byMgr.get(row.managerKey);
      if (!agg) continue;
      agg.pf += row.points;
      if (row.won) agg.wins++;
      else if (row.points === row.opponentPoints) agg.ties++;
      else agg.losses++;
    }

    const ranked = DEMO_MANAGERS.map((m) => {
      const agg = byMgr.get(m.key)!;
      return { manager: m, ...agg };
    }).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      if (b.ties !== a.ties) return b.ties - a.ties;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.manager.rosterId - b.manager.rosterId;
    });

    ranked.forEach((row, idx) => {
      const rank = idx + 1;
      const outcome = params?.outcomesBySeason?.get(season)?.get(row.manager.rosterId);
      const playoffQualified =
        outcome?.playoffQualified ?? rank <= DEMO_PLAYOFF_TEAMS;
      out.push({
        season,
        managerKey: row.manager.key,
        rank: outcome?.regularSeasonRank ?? rank,
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        totalPF: round1(row.pf),
        playoffQualified,
        playoffTeams: DEMO_PLAYOFF_TEAMS,
        playoffStartWeek: DEMO_PLAYOFF_START,
        playoffWeekEnd: DEMO_PLAYOFF_END,
        regularSeasonRank: outcome?.regularSeasonRank ?? rank,
        championshipWon: outcome?.championshipWon,
        runnerUp: outcome?.runnerUp,
        lastPlace: outcome?.lastPlace,
        finalFinish: outcome?.finalFinish,
      });
    });
  }

  return out;
}

/** All-time H2H totals from seed (same numbers the dominance grid uses). */
export function h2hTotalsForManager(managerKey: string): {
  wins: number;
  losses: number;
  ties: number;
  games: number;
  pf: number;
  pa: number;
} {
  const row = DEMO_H2H_SEED[managerKey] || {};
  let wins = 0;
  let losses = 0;
  let pf = 0;
  let pa = 0;
  for (const [opp, tuple] of Object.entries(row)) {
    if (opp === managerKey) continue;
    wins += tuple[0];
    losses += tuple[1];
    pf += tuple[2];
    pa += tuple[3];
  }
  return { wins, losses, ties: 0, games: wins + losses, pf, pa };
}
