// server/league-history/demoLeague.ts
// Fictional demo league - "Group Chat Dynasty"
// Privacy-safe, deterministic, screenshot-worthy
// Structure matches handleLeagueHistoryDominance response exactly

export const DEMO_LEAGUE_ID = "demo-group-chat-dynasty";

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

// Manager definitions with emoji avatars for demo
const MANAGERS = [
  { key: "mgr:landlord", name: "The Landlord", emoji: "👑" },
  { key: "mgr:choker", name: "Playoff Choker", emoji: "😰" },
  { key: "mgr:waiver", name: "Waiver Wizard", emoji: "🧙" },
  { key: "mgr:chaos", name: "Commissioner Chaos", emoji: "🌪️" },
  { key: "mgr:sleeper", name: "Sleeper Genius", emoji: "🧠" },
  { key: "mgr:trade", name: "Trade Bandit", emoji: "🤝" },
  { key: "mgr:injury", name: "Injury Magnet", emoji: "🩹" },
  { key: "mgr:trash", name: "Trash Talk Titan", emoji: "🗣️" },
  { key: "mgr:bye", name: "Bye Week Victim", emoji: "📅" },
  { key: "mgr:heartbreak", name: "Heartbreak Hotel", emoji: "💔" },
  { key: "mgr:autodraft", name: "Auto-Draft Guy", emoji: "🤖" },
  { key: "mgr:rebuild", name: "Rebuild Forever", emoji: "🔨" },
] as const;

// Emoji lookup by manager key
const EMOJI_BY_KEY = new Map(MANAGERS.map(m => [m.key, m.emoji]));

// Head-to-head records designed for compelling grid
// Format: [wins, losses, pf, pa] - 6 seasons × ~2 games per matchup = ~12 games max
const H2H_DATA: Record<string, Record<string, [number, number, number, number]>> = {
  "mgr:landlord": {
    "mgr:choker": [7, 5, 1456.2, 1423.8],
    "mgr:waiver": [6, 6, 1398.4, 1402.1],
    "mgr:chaos": [7, 5, 1445.3, 1389.2],
    "mgr:sleeper": [6, 6, 1412.8, 1398.6],
    "mgr:trade": [8, 4, 1489.2, 1345.7],
    "mgr:injury": [9, 3, 1523.4, 1298.1],
    "mgr:trash": [10, 2, 1567.8, 1234.5], // OWNED - strong dominance
    "mgr:bye": [8, 2, 1398.2, 1156.3], // OWNED
    "mgr:heartbreak": [7, 5, 1423.1, 1389.4],
    "mgr:autodraft": [9, 3, 1512.3, 1287.6],
    "mgr:rebuild": [10, 1, 1545.6, 1123.4], // OWNED - near perfect
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
    "mgr:autodraft": [9, 3, 1534.8, 1267.3], // OWNED - ironic domination
    "mgr:rebuild": [8, 4, 1489.4, 1312.6],
  },
  "mgr:chaos": {
    "mgr:landlord": [5, 7, 1389.2, 1445.3],
    "mgr:choker": [6, 6, 1398.7, 1412.4],
    "mgr:waiver": [5, 7, 1389.2, 1456.3],
    "mgr:sleeper": [6, 6, 1401.3, 1398.7],
    "mgr:trade": [6, 6, 1412.8, 1398.4], // RIVAL - even rivalry
    "mgr:injury": [7, 5, 1456.3, 1378.2],
    "mgr:trash": [7, 5, 1467.2, 1389.4],
    "mgr:bye": [8, 4, 1489.3, 1312.5],
    "mgr:heartbreak": [6, 6, 1402.4, 1398.7],
    "mgr:autodraft": [8, 4, 1498.2, 1323.4],
    "mgr:rebuild": [8, 4, 1489.5, 1298.6],
  },
  "mgr:sleeper": {
    "mgr:landlord": [6, 6, 1398.6, 1412.8],
    "mgr:choker": [5, 7, 1387.9, 1445.2],
    "mgr:waiver": [6, 6, 1401.8, 1412.4],
    "mgr:chaos": [6, 6, 1398.7, 1401.3],
    "mgr:trade": [7, 5, 1456.2, 1389.3],
    "mgr:injury": [8, 4, 1489.3, 1323.4],
    "mgr:trash": [7, 5, 1467.2, 1378.4],
    "mgr:bye": [8, 4, 1498.3, 1312.5],
    "mgr:heartbreak": [7, 5, 1456.8, 1398.2],
    "mgr:autodraft": [8, 4, 1489.4, 1312.3],
    "mgr:rebuild": [8, 4, 1498.2, 1298.7],
  },
  "mgr:trade": {
    "mgr:landlord": [4, 8, 1345.7, 1489.2],
    "mgr:choker": [4, 8, 1356.2, 1498.3],
    "mgr:waiver": [5, 7, 1378.9, 1467.2],
    "mgr:chaos": [6, 6, 1398.4, 1412.8], // RIVAL - spicy rivalry
    "mgr:sleeper": [5, 7, 1389.3, 1456.2],
    "mgr:injury": [7, 5, 1456.2, 1378.3],
    "mgr:trash": [6, 6, 1412.3, 1398.7],
    "mgr:bye": [7, 5, 1467.2, 1378.4],
    "mgr:heartbreak": [6, 6, 1401.4, 1398.8],
    "mgr:autodraft": [8, 4, 1489.3, 1312.4],
    "mgr:rebuild": [7, 5, 1456.8, 1367.3],
  },
  "mgr:injury": {
    "mgr:landlord": [3, 9, 1298.1, 1523.4],
    "mgr:choker": [3, 9, 1289.4, 1534.2],
    "mgr:waiver": [4, 8, 1312.4, 1498.3],
    "mgr:chaos": [5, 7, 1378.2, 1456.3],
    "mgr:sleeper": [4, 8, 1323.4, 1489.3],
    "mgr:trade": [5, 7, 1378.3, 1456.2],
    "mgr:trash": [5, 7, 1367.2, 1445.8],
    "mgr:bye": [6, 6, 1398.3, 1401.2],
    "mgr:heartbreak": [5, 7, 1378.4, 1456.2],
    "mgr:autodraft": [7, 5, 1456.2, 1378.3],
    "mgr:rebuild": [6, 6, 1401.3, 1398.7],
  },
  "mgr:trash": {
    "mgr:landlord": [2, 10, 1234.5, 1567.8], // NEMESIS - gets dominated
    "mgr:choker": [4, 8, 1345.8, 1489.5],
    "mgr:waiver": [4, 8, 1334.5, 1489.2],
    "mgr:chaos": [5, 7, 1389.4, 1467.2],
    "mgr:sleeper": [5, 7, 1378.4, 1467.2],
    "mgr:trade": [6, 6, 1398.7, 1412.3],
    "mgr:injury": [7, 5, 1445.8, 1367.2],
    "mgr:bye": [6, 6, 1401.3, 1398.7],
    "mgr:heartbreak": [5, 7, 1378.2, 1456.3],
    "mgr:autodraft": [7, 5, 1456.3, 1378.2],
    "mgr:rebuild": [6, 6, 1401.4, 1398.8],
  },
  "mgr:bye": {
    "mgr:landlord": [2, 8, 1156.3, 1398.2], // NEMESIS
    "mgr:choker": [3, 9, 1278.9, 1523.4],
    "mgr:waiver": [4, 8, 1298.7, 1478.3],
    "mgr:chaos": [4, 8, 1312.5, 1489.3],
    "mgr:sleeper": [4, 8, 1312.5, 1498.3],
    "mgr:trade": [5, 7, 1378.4, 1467.2],
    "mgr:injury": [6, 6, 1401.2, 1398.3],
    "mgr:trash": [6, 6, 1398.7, 1401.3],
    "mgr:heartbreak": [5, 7, 1367.3, 1456.2],
    "mgr:autodraft": [6, 6, 1398.4, 1401.3],
    "mgr:rebuild": [5, 7, 1378.3, 1456.4],
  },
  "mgr:heartbreak": {
    "mgr:landlord": [5, 7, 1389.4, 1423.1],
    "mgr:choker": [5, 7, 1398.2, 1456.8],
    "mgr:waiver": [5, 7, 1389.4, 1456.2],
    "mgr:chaos": [6, 6, 1398.7, 1402.4],
    "mgr:sleeper": [5, 7, 1398.2, 1456.8],
    "mgr:trade": [6, 6, 1398.8, 1401.4],
    "mgr:injury": [7, 5, 1456.2, 1378.4],
    "mgr:trash": [7, 5, 1456.3, 1378.2],
    "mgr:bye": [7, 5, 1456.2, 1367.3],
    "mgr:autodraft": [7, 5, 1456.4, 1378.2],
    "mgr:rebuild": [6, 6, 1401.3, 1398.7],
  },
  "mgr:autodraft": {
    "mgr:landlord": [3, 9, 1287.6, 1512.3],
    "mgr:choker": [2, 10, 1234.1, 1567.3],
    "mgr:waiver": [3, 9, 1267.3, 1534.8], // NEMESIS - gets dominated by Waiver Wizard (ironic)
    "mgr:chaos": [4, 8, 1323.4, 1498.2],
    "mgr:sleeper": [4, 8, 1312.3, 1489.4],
    "mgr:trade": [4, 8, 1312.4, 1489.3],
    "mgr:injury": [5, 7, 1378.3, 1456.2],
    "mgr:trash": [5, 7, 1378.2, 1456.3],
    "mgr:bye": [6, 6, 1401.3, 1398.4],
    "mgr:heartbreak": [5, 7, 1378.2, 1456.4],
    "mgr:rebuild": [5, 7, 1378.3, 1456.2],
  },
  "mgr:rebuild": {
    "mgr:landlord": [1, 10, 1123.4, 1545.6], // NEMESIS - perpetual victim
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

function computeBadge(wins: number, losses: number, games: number, score: number): Badge {
  // Perfect records bypass small sample check
  if (wins >= 3 && losses === 0) return "OWNED";
  if (wins === 0 && losses >= 3) return "NEMESIS";
  if (games < 4) return "SMALL SAMPLE";
  if (games >= 5 && Math.abs(score) <= 0.20) return "RIVAL";
  
  if (wins === 3 && losses === 1) return "EDGE";
  if (wins === 1 && losses === 3) return "EDGE";
  if (wins === 2 && losses === 0) return "EDGE";
  if (wins === 0 && losses === 2) return "EDGE";
  
  // Score-based upgrades
  if (score >= 0.5) return "OWNED";
  if (score <= -0.5) return "NEMESIS";
  if (Math.abs(score) <= 0.20) return "RIVAL";
  
  return "EDGE";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildGrid(): GridRow[] {
  const rows: GridRow[] = [];
  
  for (const manager of MANAGERS) {
    const opponents: GridCell[] = [];
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;
    let totalPF = 0;
    let totalPA = 0;
    
    for (const opp of MANAGERS) {
      if (opp.key === manager.key) continue;
      
      const h2h = H2H_DATA[manager.key]?.[opp.key] || [0, 0, 0, 0];
      const [wins, losses, pf, pa] = h2h;
      const ties = 0;
      const games = wins + losses + ties;
      const score = games > 0 ? (wins - losses) / games : 0;
      const badge = computeBadge(wins, losses, games, score);
      
      const displayRecord = `${wins}–${losses}`;
      const s2 = round2(score);
      const displayScore = `${s2 >= 0 ? "+" : ""}${s2.toFixed(2)}`;
      
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
          record: displayRecord,
          score: displayScore,
        },
      });
      
      totalWins += wins;
      totalLosses += losses;
      totalTies += ties;
      totalPF += pf;
      totalPA += pa;
    }
    
    const totalGames = totalWins + totalLosses + totalTies;
    const totalScore = totalGames > 0 ? (totalWins - totalLosses) / totalGames : 0;
    
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
      totalScore: round2(totalScore),
    });
  }
  
  // Sort by totalWins desc, then totalScore desc
  rows.sort((a, b) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.totalScore - a.totalScore;
  });
  
  // Re-sort opponents to match row order
  const sortedKeys = rows.map(r => r.key);
  const order = new Map(sortedKeys.map((k, i) => [k, i]));
  for (const r of rows) {
    r.opponents.sort((x, y) => (order.get(x.opponent_key) ?? 999) - (order.get(y.opponent_key) ?? 999));
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
    }))
  );
}

function buildTotalsByManager(grid: GridRow[]) {
  return grid.map((r) => ({
    key: r.key,
    name: r.name,
    avatarUrl: null, // No Sleeper avatars for fictional managers
    emoji: EMOJI_BY_KEY.get(r.key) || null, // Emoji avatar for demo league
    totalWins: r.totalWins,
    totalLosses: r.totalLosses,
    totalTies: r.totalTies,
    totalGames: r.totalGames,
    totalPF: r.totalPF,
    totalPA: r.totalPA,
    totalScore: r.totalScore,
  }));
}

// Season stats - Playoff Choker: 3x #1 seed, 0 championships
const SEASON_STATS = [
  // 2024 - Playoff Choker #1 seed
  { season: "2024", managerKey: "mgr:choker", rank: 1, wins: 11, losses: 3, totalPF: 1876.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:landlord", rank: 2, wins: 10, losses: 4, totalPF: 1823.1, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:waiver", rank: 3, wins: 9, losses: 5, totalPF: 1789.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:chaos", rank: 4, wins: 8, losses: 6, totalPF: 1734.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:sleeper", rank: 5, wins: 8, losses: 6, totalPF: 1712.8, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1678.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:injury", rank: 7, wins: 6, losses: 8, totalPF: 1623.5, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:trash", rank: 8, wins: 6, losses: 8, totalPF: 1598.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:heartbreak", rank: 9, wins: 5, losses: 9, totalPF: 1567.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:bye", rank: 10, wins: 5, losses: 9, totalPF: 1534.1, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:autodraft", rank: 11, wins: 4, losses: 10, totalPF: 1489.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2024", managerKey: "mgr:rebuild", rank: 12, wins: 3, losses: 11, totalPF: 1423.8, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  
  // 2023 - Playoff Choker #1 seed again
  { season: "2023", managerKey: "mgr:choker", rank: 1, wins: 12, losses: 2, totalPF: 1945.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:landlord", rank: 2, wins: 10, losses: 4, totalPF: 1867.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:sleeper", rank: 3, wins: 9, losses: 5, totalPF: 1812.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:waiver", rank: 4, wins: 8, losses: 6, totalPF: 1756.8, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:chaos", rank: 5, wins: 8, losses: 6, totalPF: 1734.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1698.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:heartbreak", rank: 7, wins: 6, losses: 8, totalPF: 1645.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:injury", rank: 8, wins: 6, losses: 8, totalPF: 1612.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:trash", rank: 9, wins: 5, losses: 9, totalPF: 1578.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:bye", rank: 10, wins: 4, losses: 10, totalPF: 1523.1, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:autodraft", rank: 11, wins: 4, losses: 10, totalPF: 1498.7, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2023", managerKey: "mgr:rebuild", rank: 12, wins: 3, losses: 11, totalPF: 1434.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  
  // 2022 - Playoff Choker #1 seed again
  { season: "2022", managerKey: "mgr:choker", rank: 1, wins: 10, losses: 4, totalPF: 1801.8, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:landlord", rank: 2, wins: 10, losses: 4, totalPF: 1798.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:waiver", rank: 3, wins: 9, losses: 5, totalPF: 1756.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:sleeper", rank: 4, wins: 8, losses: 6, totalPF: 1712.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:chaos", rank: 5, wins: 7, losses: 7, totalPF: 1678.9, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1656.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:injury", rank: 7, wins: 6, losses: 8, totalPF: 1612.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:heartbreak", rank: 8, wins: 6, losses: 8, totalPF: 1589.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:trash", rank: 9, wins: 5, losses: 9, totalPF: 1545.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:bye", rank: 10, wins: 5, losses: 9, totalPF: 1512.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:autodraft", rank: 11, wins: 4, losses: 10, totalPF: 1467.8, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2022", managerKey: "mgr:rebuild", rank: 12, wins: 3, losses: 11, totalPF: 1401.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  
  // 2021
  { season: "2021", managerKey: "mgr:landlord", rank: 1, wins: 11, losses: 3, totalPF: 1867.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:choker", rank: 2, wins: 10, losses: 4, totalPF: 1834.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:sleeper", rank: 3, wins: 9, losses: 5, totalPF: 1789.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:waiver", rank: 4, wins: 8, losses: 6, totalPF: 1734.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:chaos", rank: 5, wins: 7, losses: 7, totalPF: 1689.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1678.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:heartbreak", rank: 7, wins: 6, losses: 8, totalPF: 1623.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:injury", rank: 8, wins: 6, losses: 8, totalPF: 1598.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:trash", rank: 9, wins: 5, losses: 9, totalPF: 1556.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:bye", rank: 10, wins: 4, losses: 10, totalPF: 1501.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:autodraft", rank: 11, wins: 4, losses: 10, totalPF: 1478.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2021", managerKey: "mgr:rebuild", rank: 12, wins: 3, losses: 11, totalPF: 1412.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  
  // 2020
  { season: "2020", managerKey: "mgr:landlord", rank: 1, wins: 11, losses: 3, totalPF: 1845.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:waiver", rank: 2, wins: 10, losses: 4, totalPF: 1812.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:choker", rank: 3, wins: 9, losses: 5, totalPF: 1789.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:sleeper", rank: 4, wins: 8, losses: 6, totalPF: 1723.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:chaos", rank: 5, wins: 7, losses: 7, totalPF: 1678.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1656.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:injury", rank: 7, wins: 6, losses: 8, totalPF: 1601.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:heartbreak", rank: 8, wins: 5, losses: 9, totalPF: 1567.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:trash", rank: 9, wins: 5, losses: 9, totalPF: 1534.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:bye", rank: 10, wins: 4, losses: 10, totalPF: 1489.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:autodraft", rank: 11, wins: 4, losses: 10, totalPF: 1456.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2020", managerKey: "mgr:rebuild", rank: 12, wins: 2, losses: 12, totalPF: 1378.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  
  // 2019
  { season: "2019", managerKey: "mgr:landlord", rank: 1, wins: 10, losses: 4, totalPF: 1798.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:sleeper", rank: 2, wins: 9, losses: 5, totalPF: 1756.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:waiver", rank: 3, wins: 9, losses: 5, totalPF: 1734.4, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:choker", rank: 4, wins: 8, losses: 6, totalPF: 1701.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:chaos", rank: 5, wins: 7, losses: 7, totalPF: 1667.3, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:trade", rank: 6, wins: 7, losses: 7, totalPF: 1645.2, playoffQualified: true, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:heartbreak", rank: 7, wins: 6, losses: 8, totalPF: 1598.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:injury", rank: 8, wins: 5, losses: 9, totalPF: 1556.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:trash", rank: 9, wins: 5, losses: 9, totalPF: 1512.3, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:bye", rank: 10, wins: 4, losses: 10, totalPF: 1467.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:autodraft", rank: 11, wins: 3, losses: 11, totalPF: 1423.2, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
  { season: "2019", managerKey: "mgr:rebuild", rank: 12, wins: 3, losses: 11, totalPF: 1389.4, playoffQualified: false, playoffTeams: 6, playoffStartWeek: 15, playoffWeekEnd: 17 },
];

// Weekly matchups - includes key story moments
const WEEKLY_MATCHUPS = [
  // === ICONIC BLOWOUT: The Landlord 167.4 vs Rebuild Forever 62.1 (Week 8, 2024) ===
  { season: "2024", week: 8, managerKey: "mgr:landlord", opponentKey: "mgr:rebuild", points: 167.4, opponentPoints: 62.1, margin: 105.3, won: true },
  { season: "2024", week: 8, managerKey: "mgr:rebuild", opponentKey: "mgr:landlord", points: 62.1, opponentPoints: 167.4, margin: -105.3, won: false },
  
  // === HEARTBREAK HOTEL: Multiple close losses (<5 points) ===
  { season: "2024", week: 3, managerKey: "mgr:heartbreak", opponentKey: "mgr:sleeper", points: 118.4, opponentPoints: 121.2, margin: -2.8, won: false },
  { season: "2024", week: 3, managerKey: "mgr:sleeper", opponentKey: "mgr:heartbreak", points: 121.2, opponentPoints: 118.4, margin: 2.8, won: true },
  { season: "2024", week: 7, managerKey: "mgr:heartbreak", opponentKey: "mgr:waiver", points: 132.1, opponentPoints: 135.9, margin: -3.8, won: false },
  { season: "2024", week: 7, managerKey: "mgr:waiver", opponentKey: "mgr:heartbreak", points: 135.9, opponentPoints: 132.1, margin: 3.8, won: true },
  { season: "2024", week: 11, managerKey: "mgr:heartbreak", opponentKey: "mgr:chaos", points: 109.8, opponentPoints: 113.1, margin: -3.3, won: false },
  { season: "2024", week: 11, managerKey: "mgr:chaos", opponentKey: "mgr:heartbreak", points: 113.1, opponentPoints: 109.8, margin: 3.3, won: true },
  { season: "2023", week: 5, managerKey: "mgr:heartbreak", opponentKey: "mgr:trade", points: 127.3, opponentPoints: 129.8, margin: -2.5, won: false },
  { season: "2023", week: 5, managerKey: "mgr:trade", opponentKey: "mgr:heartbreak", points: 129.8, opponentPoints: 127.3, margin: 2.5, won: true },
  { season: "2023", week: 9, managerKey: "mgr:heartbreak", opponentKey: "mgr:choker", points: 141.2, opponentPoints: 144.7, margin: -3.5, won: false },
  { season: "2023", week: 9, managerKey: "mgr:choker", opponentKey: "mgr:heartbreak", points: 144.7, opponentPoints: 141.2, margin: 3.5, won: true },
  { season: "2022", week: 4, managerKey: "mgr:heartbreak", opponentKey: "mgr:landlord", points: 115.6, opponentPoints: 119.2, margin: -3.6, won: false },
  { season: "2022", week: 4, managerKey: "mgr:landlord", opponentKey: "mgr:heartbreak", points: 119.2, opponentPoints: 115.6, margin: 3.6, won: true },
  { season: "2022", week: 12, managerKey: "mgr:heartbreak", opponentKey: "mgr:injury", points: 108.4, opponentPoints: 112.1, margin: -3.7, won: false },
  { season: "2022", week: 12, managerKey: "mgr:injury", opponentKey: "mgr:heartbreak", points: 112.1, opponentPoints: 108.4, margin: 3.7, won: true },
  
  // === COMMISSIONER CHAOS vs TRADE BANDIT rivalry matchups ===
  { season: "2024", week: 6, managerKey: "mgr:chaos", opponentKey: "mgr:trade", points: 124.3, opponentPoints: 121.8, margin: 2.5, won: true },
  { season: "2024", week: 6, managerKey: "mgr:trade", opponentKey: "mgr:chaos", points: 121.8, opponentPoints: 124.3, margin: -2.5, won: false },
  { season: "2024", week: 13, managerKey: "mgr:chaos", opponentKey: "mgr:trade", points: 118.7, opponentPoints: 123.4, margin: -4.7, won: false },
  { season: "2024", week: 13, managerKey: "mgr:trade", opponentKey: "mgr:chaos", points: 123.4, opponentPoints: 118.7, margin: 4.7, won: true },
  
  // === WAIVER WIZARD dominates AUTO-DRAFT GUY (ironic) ===
  { season: "2024", week: 2, managerKey: "mgr:waiver", opponentKey: "mgr:autodraft", points: 143.2, opponentPoints: 98.7, margin: 44.5, won: true },
  { season: "2024", week: 2, managerKey: "mgr:autodraft", opponentKey: "mgr:waiver", points: 98.7, opponentPoints: 143.2, margin: -44.5, won: false },
  { season: "2024", week: 10, managerKey: "mgr:waiver", opponentKey: "mgr:autodraft", points: 138.6, opponentPoints: 112.3, margin: 26.3, won: true },
  { season: "2024", week: 10, managerKey: "mgr:autodraft", opponentKey: "mgr:waiver", points: 112.3, opponentPoints: 138.6, margin: -26.3, won: false },
  
  // === THE LANDLORD dominates TRASH TALK TITAN ===
  { season: "2024", week: 4, managerKey: "mgr:landlord", opponentKey: "mgr:trash", points: 156.8, opponentPoints: 112.4, margin: 44.4, won: true },
  { season: "2024", week: 4, managerKey: "mgr:trash", opponentKey: "mgr:landlord", points: 112.4, opponentPoints: 156.8, margin: -44.4, won: false },
  { season: "2024", week: 12, managerKey: "mgr:landlord", opponentKey: "mgr:trash", points: 148.2, opponentPoints: 118.9, margin: 29.3, won: true },
  { season: "2024", week: 12, managerKey: "mgr:trash", opponentKey: "mgr:landlord", points: 118.9, opponentPoints: 148.2, margin: -29.3, won: false },
  
  // === Additional sample matchups for variety ===
  { season: "2024", week: 1, managerKey: "mgr:choker", opponentKey: "mgr:rebuild", points: 145.3, opponentPoints: 98.2, margin: 47.1, won: true },
  { season: "2024", week: 1, managerKey: "mgr:rebuild", opponentKey: "mgr:choker", points: 98.2, opponentPoints: 145.3, margin: -47.1, won: false },
  { season: "2024", week: 1, managerKey: "mgr:landlord", opponentKey: "mgr:bye", points: 138.4, opponentPoints: 104.2, margin: 34.2, won: true },
  { season: "2024", week: 1, managerKey: "mgr:bye", opponentKey: "mgr:landlord", points: 104.2, opponentPoints: 138.4, margin: -34.2, won: false },
  { season: "2024", week: 5, managerKey: "mgr:sleeper", opponentKey: "mgr:injury", points: 134.6, opponentPoints: 112.3, margin: 22.3, won: true },
  { season: "2024", week: 5, managerKey: "mgr:injury", opponentKey: "mgr:sleeper", points: 112.3, opponentPoints: 134.6, margin: -22.3, won: false },
  { season: "2024", week: 9, managerKey: "mgr:chaos", opponentKey: "mgr:autodraft", points: 128.7, opponentPoints: 101.4, margin: 27.3, won: true },
  { season: "2024", week: 9, managerKey: "mgr:autodraft", opponentKey: "mgr:chaos", points: 101.4, opponentPoints: 128.7, margin: -27.3, won: false },
  { season: "2024", week: 14, managerKey: "mgr:waiver", opponentKey: "mgr:sleeper", points: 131.2, opponentPoints: 128.9, margin: 2.3, won: true },
  { season: "2024", week: 14, managerKey: "mgr:sleeper", opponentKey: "mgr:waiver", points: 128.9, opponentPoints: 131.2, margin: -2.3, won: false },
];

/**
 * Returns demo league data matching exact structure of handleLeagueHistoryDominance
 */
export function getDemoLeagueData() {
  const grid = buildGrid();
  const cells = buildCells(grid);
  const totalsByManager = buildTotalsByManager(grid);
  
  return {
    league: {
      league_id: DEMO_LEAGUE_ID,
      name: "Group Chat Dynasty",
      season: "2019–2024",
    },
    history: {
      league_ids: [DEMO_LEAGUE_ID],
      seasons: ["2024", "2023", "2022", "2021", "2020", "2019"],
      count: 6,
    },
    grid,
    cells,
    totalsByManager,
    seasonStats: SEASON_STATS,
    weeklyMatchups: WEEKLY_MATCHUPS,
    defaultRegularSeasonEnd: 14,
    playoffStartBySeason: {
      "2024": 15,
      "2023": 15,
      "2022": 15,
      "2021": 15,
      "2020": 15,
      "2019": 15,
    },
  };
}
