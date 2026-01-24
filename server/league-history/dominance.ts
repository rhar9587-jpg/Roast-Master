// server/league-history/dominance.ts

export type Badge = "OWNED" | "NEMESIS" | "RIVAL" | "EDGE" | "SMALL SAMPLE";

export type Cell = {
  a_roster_id: number;
  b_roster_id: number;

  games: number;
  wins: number;
  losses: number;
  ties: number;

  // totals for rivalry preview
  pointsFor: number;
  pointsAgainst: number;

  // computed
  win_pct: number;     // wins/games
  dominance: number;   // (wins - losses)/games  (keep for backward-compat)
  score: number;       // alias of dominance (matches your v1 spec)

  // display helpers for UI
  displayRecord: string; // "7–3" or "7–3–0"
  displayScore: string;  // "+0.40"

  badge: Badge;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function badgeForCell(cell: Omit<Cell, "badge">): Badge {
  const games = cell.games ?? 0;
  const wins = cell.wins ?? 0;
  const losses = cell.losses ?? 0;

  // small sample
  if (games < 4) return "SMALL SAMPLE";

  // (wins-losses)/games (use computed if already present)
  const score =
    typeof cell.score === "number" ? cell.score : games ? (wins - losses) / games : 0;

  // ✅ Clean sweep rule: 3–0 / 4–0 etc.
  if (losses === 0 && wins >= 3) return "OWNED";
  if (wins === 0 && losses >= 3) return "NEMESIS";

  // ✅ Rival: games >= 5 and close score
  if (games >= 5 && Math.abs(score) <= 0.20) return "RIVAL";

  // ✅ Dominance thresholds scale with sample size
  if (games >= 10) {
    if (score >= 0.35) return "OWNED";
    if (score <= -0.35) return "NEMESIS";
  } else if (games >= 6) {
    if (score >= 0.40) return "OWNED";
    if (score <= -0.40) return "NEMESIS";
  }

  return "EDGE";
}

export function emptyCell(a: number, b: number): Cell {
  return {
    a_roster_id: a,
    b_roster_id: b,
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    win_pct: 0,
    dominance: 0,
    score: 0,
    displayRecord: "0–0",
    displayScore: "+0.00",
    badge: "EDGE",
  };
}

// Keep signature the same: finalizeCell(base) -> Cell
export function finalizeCell(base: Omit<Cell, "badge">): Cell {
  const games = base.games || 0;
  const wins = base.wins || 0;
  const losses = base.losses || 0;
  const ties = base.ties || 0;

  const win_pct = games ? wins / games : 0;
  const score = games ? (wins - losses) / games : 0;

  const dominance = score; // keep old field as alias

  const displayRecord = ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;

  const s2 = round2(score);
  const displayScore = `${s2 >= 0 ? "+" : ""}${s2.toFixed(2)}`;

  const withStats: Omit<Cell, "badge"> = {
    ...base,
    win_pct,
    dominance,
    score,
    displayRecord,
    displayScore,
  };

  return { ...withStats, badge: badgeForCell(withStats) };
}