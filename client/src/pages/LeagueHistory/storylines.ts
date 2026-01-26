import type { DominanceCellDTO, ManagerRow, RowTotal, WeeklyMatchupDetail, SeasonStat } from "./types";
import { fmtScore } from "./utils";

export type MiniCard = {
  id: string;
  title: string;
  statPrimary: string;
  statSecondary?: string;
  meta?: string;
  line: string;
  detail?: string;
  cellKey?: string;
  managerKey?: string;
};

type TotalsByManagerEntry = {
  key: string;
  name: string;
  totalPF: number;
  totalPA: number;
};

// Credibility guardrails
const MIN_GAMES_FOR_STORYLINE = 5;
const MIN_GAMES_FOR_PERSONAL = 5;
const MIN_WINS_FOR_UNTOUCHABLE = 3;
const SEVERE_OWNED_SCORE = 0.4;
const SEVERE_NEMESIS_SCORE = -0.4;
const MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG = 20;

function meetsStoryline(c: DominanceCellDTO): boolean {
  return (c?.games ?? 0) >= MIN_GAMES_FOR_STORYLINE;
}

function meetsPersonal(c: DominanceCellDTO): boolean {
  return (c?.games ?? 0) >= MIN_GAMES_FOR_PERSONAL;
}

/** Parse "W-L" or "W-L-T" and return [w, l, games]. */
function parseRecord(record: string): [number, number] {
  const parts = record.split(/[–-]/).map((s) => parseInt(s.trim(), 10));
  const w = Number.isNaN(parts[0]) ? 0 : parts[0];
  const l = Number.isNaN(parts[1]) ? 0 : parts[1];
  return [w, l];
}

/** League Storylines: 5 mini cards from league-wide data. */
export function computeLeagueStorylines(
  allCells: DominanceCellDTO[],
  managers: ManagerRow[],
  rowTotals: Map<string, RowTotal>,
  totalsByManager: TotalsByManagerEntry[] | null,
  totalLeagueGames: number
): MiniCard[] {
  const cards: MiniCard[] = [];
  const nameByKey = new Map(managers.map((m) => [m.key, m.name]));

  // 1. Everybody's Victim — NEMESIS where games >= MIN_GAMES_FOR_STORYLINE AND score <= SEVERE_NEMESIS_SCORE
  const nemesisByVictim = new Map<
    string,
    { count: number; exampleCellKey: string; exampleScore: number }
  >();
  for (const c of allCells) {
    if (
      !c ||
      c.badge !== "NEMESIS" ||
      !meetsStoryline(c) ||
      (c.score ?? 0) > SEVERE_NEMESIS_SCORE ||
      !c.a ||
      !c.b
    )
      continue;
    const cur = nemesisByVictim.get(c.b);
    const cellKey = `${c.a}-${c.b}`;
    if (!cur) {
      nemesisByVictim.set(c.b, {
        count: 1,
        exampleCellKey: cellKey,
        exampleScore: c.score ?? 0,
      });
    } else {
      cur.count += 1;
      if ((c.score ?? 0) <= cur.exampleScore) {
        cur.exampleCellKey = cellKey;
        cur.exampleScore = c.score ?? 0;
      }
    }
  }
  let everybodyVictim: {
    key: string;
    name: string;
    count: number;
    cellKey: string;
  } | null = null;
  for (const [key, v] of Array.from(nemesisByVictim.entries())) {
    if (
      v.count > 0 &&
      (!everybodyVictim || v.count > everybodyVictim.count)
    ) {
      everybodyVictim = {
        key,
        name: nameByKey.get(key) ?? key,
        count: v.count,
        cellKey: v.exampleCellKey,
      };
    }
  }
  if (everybodyVictim && everybodyVictim.count > 0) {
    cards.push({
      id: "everybodys-victim",
      title: "EVERYBODY'S VICTIM",
      statPrimary: String(everybodyVictim.count),
      line: "Everyone has receipts.",
      detail: everybodyVictim.name,
      cellKey: everybodyVictim.cellKey,
    });
  }

  // 2. Point Differential King — max (totalPF - totalPA), sign + rounded int
  if (totalsByManager && totalsByManager.length > 0) {
    let best: { key: string; name: string; diff: number } | null = null;
    for (const t of totalsByManager) {
      const diff = t.totalPF - t.totalPA;
      if (!best || diff > best.diff) best = { key: t.key, name: t.name, diff };
    }
    if (best) {
      const sign = best.diff >= 0 ? "+" : "";
      cards.push({
        id: "point-diff-king",
        title: "POINT DIFFERENTIAL KING",
        statPrimary: `${sign}${Math.round(best.diff)} pts`,
        line: "Biggest flex in the league.",
        detail: best.name,
        managerKey: best.key,
      });
    }
  }

  // 3. Punching Bag — most losses; require totalLeagueGames >= MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG
  if (totalLeagueGames >= MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG) {
    let punchingBag: { key: string; name: string; losses: number } | null =
      null;
    for (const m of managers) {
      const rt = rowTotals.get(m.key);
      if (!rt) continue;
      if (!punchingBag || rt.l > punchingBag.losses)
        punchingBag = { key: m.key, name: m.name, losses: rt.l };
    }
    if (punchingBag && punchingBag.losses > 0) {
      cards.push({
        id: "punching-bag",
        title: "PUNCHING BAG",
        statPrimary: String(punchingBag.losses),
        line: "Took more L's than anyone.",
        detail: punchingBag.name,
        managerKey: punchingBag.key,
      });
    }
  }

  // 4. Untouchable — OWNED, losses === 0, wins >= MIN_WINS_FOR_UNTOUCHABLE, games >= MIN_GAMES_FOR_STORYLINE
  const untouchableByLandlord = new Map<
    string,
    { count: number; topCellKey: string; topGames: number }
  >();
  for (const c of allCells) {
    if (!c || c.badge !== "OWNED" || !meetsStoryline(c) || !c.a) continue;
    const [w, l] = parseRecord(c.record);
    if (l !== 0 || w < MIN_WINS_FOR_UNTOUCHABLE) continue;
    const cur = untouchableByLandlord.get(c.a);
    const cellKey = `${c.a}-${c.b}`;
    const games = c.games ?? 0;
    if (!cur) {
      untouchableByLandlord.set(c.a, {
        count: 1,
        topCellKey: cellKey,
        topGames: games,
      });
    } else {
      cur.count += 1;
      if (games > cur.topGames) {
        cur.topCellKey = cellKey;
        cur.topGames = games;
      }
    }
  }
  let untouchable: {
    key: string;
    name: string;
    count: number;
    cellKey: string;
  } | null = null;
  for (const [key, v] of Array.from(untouchableByLandlord.entries())) {
    if (
      v.count > 0 &&
      (!untouchable || v.count > untouchable.count)
    ) {
      untouchable = {
        key,
        name: nameByKey.get(key) ?? key,
        count: v.count,
        cellKey: v.topCellKey,
      };
    }
  }
  if (untouchable && untouchable.count > 0) {
    cards.push({
      id: "untouchable",
      title: "UNTOUCHABLE",
      statPrimary: String(untouchable.count),
      line: "Never lost. Rent is due.",
      detail: untouchable.name,
      cellKey: untouchable.cellKey,
    });
  }

  // 5. Rival Central — RIVAL where games >= MIN_GAMES_FOR_STORYLINE; longest by games
  const rivalCells = allCells.filter(
    (c) =>
      c &&
      c.badge === "RIVAL" &&
      meetsStoryline(c)
  );
  if (rivalCells.length > 0) {
    const byGames = [...rivalCells].sort(
      (a, b) => (b.games ?? 0) - (a.games ?? 0)
    );
    const top = byGames[0];
    const games = top?.games ?? 0;
    if (games > 0 && top) {
      cards.push({
        id: "rival-central",
        title: "RIVAL CENTRAL",
        statPrimary: top.record,
        statSecondary: `Ownership score ${fmtScore(top.score)}`,
        meta: `${games} games`,
        line: "Still can't settle it.",
        detail: `${top.aName} vs ${top.bName}`,
        cellKey: `${top.a}-${top.b}`,
      });
    }
  }

  return cards;
}

/** Your Roast: 3 mini cards. Only when viewerKey set; games >= MIN_GAMES_FOR_PERSONAL. */
export function computeYourRoast(
  viewerKey: string,
  allCells: DominanceCellDTO[],
  managers: ManagerRow[]
): MiniCard[] {
  if (!viewerKey) return [];
  const cards: MiniCard[] = [];

  const myOwned = allCells.filter(
    (c) =>
      c &&
      c.a === viewerKey &&
      c.badge === "OWNED" &&
      meetsPersonal(c) &&
      (c.score ?? 0) >= SEVERE_OWNED_SCORE
  );
  const bestOwned = [...myOwned].sort(
    (a, b) => (b?.score ?? 0) - (a?.score ?? 0)
  )[0];
  if (bestOwned) {
    cards.push({
      id: "your-favorite-victim",
      title: "YOUR FAVORITE VICTIM",
      statPrimary: bestOwned.record,
      statSecondary: `Ownership score ${fmtScore(bestOwned.score)}`,
      meta: `${bestOwned.games} games`,
      line: "You own them.",
      detail: bestOwned.bName,
      cellKey: `${bestOwned.a}-${bestOwned.b}`,
    });
  }

  const myNemesis = allCells.filter(
    (c) =>
      c &&
      c.a === viewerKey &&
      c.badge === "NEMESIS" &&
      meetsPersonal(c) &&
      (c.score ?? 0) <= SEVERE_NEMESIS_SCORE
  );
  const worstNemesis = [...myNemesis].sort(
    (a, b) => (a?.score ?? 0) - (b?.score ?? 0)
  )[0];
  if (worstNemesis) {
    cards.push({
      id: "your-kryptonite",
      title: "YOUR KRYPTONITE",
      statPrimary: worstNemesis.record,
      statSecondary: `Ownership score ${fmtScore(worstNemesis.score)}`,
      meta: `${worstNemesis.games} games`,
      line: "They cook you.",
      detail: worstNemesis.bName,
      cellKey: `${worstNemesis.a}-${worstNemesis.b}`,
    });
  }

  const myRivals = allCells.filter(
    (c) =>
      c &&
      c.badge === "RIVAL" &&
      meetsPersonal(c) &&
      (c.a === viewerKey || c.b === viewerKey)
  );
  const longestRival = [...myRivals].sort(
    (a, b) => (b?.games ?? 0) - (a?.games ?? 0)
  )[0];
  if (longestRival) {
    const other =
      longestRival.a === viewerKey
        ? longestRival.bName
        : longestRival.aName;
    cards.push({
      id: "your-unfinished-business",
      title: "YOUR UNFINISHED BUSINESS",
      statPrimary: longestRival.record,
      statSecondary: `Ownership score ${fmtScore(longestRival.score)}`,
      meta: `${longestRival.games} games`,
      line: "This one's personal.",
      detail: other,
      cellKey: `${longestRival.a}-${longestRival.b}`,
    });
  }

  // Fallback cards: if no real receipts qualify, show 2-3 fallback cards
  if (cards.length === 0) {
    // a) Most Played Opponent — max games vs anyone (viewer as a or b)
    const myMatchups = allCells.filter(
      (c) =>
        c &&
        (c.a === viewerKey || c.b === viewerKey) &&
        (c.games ?? 0) >= 3
    );
    const mostPlayed = [...myMatchups].sort(
      (a, b) => (b?.games ?? 0) - (a?.games ?? 0)
    )[0];
    if (mostPlayed) {
      const other =
        mostPlayed.a === viewerKey ? mostPlayed.bName : mostPlayed.aName;
      cards.push({
        id: "most-played-opponent",
        title: "MOST PLAYED OPPONENT",
        statPrimary: mostPlayed.record,
        statSecondary: `Ownership score ${fmtScore(mostPlayed.score)}`,
        meta: `${mostPlayed.games} games`,
        line: "You've faced them the most.",
        detail: other,
        cellKey: `${mostPlayed.a}-${mostPlayed.b}`,
      });
    }

    // b) Closest Matchup — EDGE or SMALL SAMPLE with most games (min 3)
    const closeMatchups = allCells.filter(
      (c) =>
        c &&
        (c.a === viewerKey || c.b === viewerKey) &&
        (c.games ?? 0) >= 3 &&
        (c.badge === "EDGE" || c.badge === "SMALL SAMPLE")
    );
    const closest = [...closeMatchups].sort(
      (a, b) => (b?.games ?? 0) - (a?.games ?? 0)
    )[0];
    if (closest && closest !== mostPlayed) {
      const other = closest.a === viewerKey ? closest.bName : closest.aName;
      cards.push({
        id: "closest-matchup",
        title: "CLOSEST MATCHUP",
        statPrimary: closest.record,
        statSecondary: `Ownership score ${fmtScore(closest.score)}`,
        meta: `${closest.games} games`,
        line: "Too close to call.",
        detail: other,
        cellKey: `${closest.a}-${closest.b}`,
      });
    }

    // c) Most Even Rival — min abs(score) with games >= 3
    const evenMatchups = allCells.filter(
      (c) =>
        c &&
        (c.a === viewerKey || c.b === viewerKey) &&
        (c.games ?? 0) >= 3
    );
    const mostEven = [...evenMatchups].sort(
      (a, b) => Math.abs(a?.score ?? 0) - Math.abs(b?.score ?? 0)
    )[0];
    if (
      mostEven &&
      mostEven !== mostPlayed &&
      mostEven !== closest
    ) {
      const other = mostEven.a === viewerKey ? mostEven.bName : mostEven.aName;
      cards.push({
        id: "most-even-rival",
        title: "MOST EVEN RIVAL",
        statPrimary: mostEven.record,
        statSecondary: `Ownership score ${fmtScore(mostEven.score)}`,
        meta: `${mostEven.games} games`,
        line: "This one's dead even.",
        detail: other,
        cellKey: `${mostEven.a}-${mostEven.b}`,
      });
    }
  }

  return cards;
}

/** Additional MINI cards computed from seasonStats and weeklyMatchups */
export function computeAdditionalMiniCards(
  weeklyMatchups: WeeklyMatchupDetail[],
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
): MiniCard[] {
  const cards: MiniCard[] = [];

  // Heartbreaker: Most losses by <5 points
  const heartbreaker = computeHeartbreaker(weeklyMatchups, managers);
  if (heartbreaker) cards.push(heartbreaker);

  // Blowout Artist: Most wins by 30+ points
  const blowoutArtist = computeBlowoutArtist(weeklyMatchups, managers);
  if (blowoutArtist) cards.push(blowoutArtist);

  // Giant Slayer: Most wins vs #1 seed
  const giantSlayer = computeGiantSlayer(weeklyMatchups, seasonStats, managers);
  if (giantSlayer) cards.push(giantSlayer);

  return cards;
}

function computeHeartbreaker(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
): MiniCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Count close losses (<5 points) per manager
  const closeLossCounts = new Map<string, number>();
  for (const matchup of weeklyMatchups) {
    if (!matchup.won && Math.abs(matchup.margin) < 5) {
      const current = closeLossCounts.get(matchup.managerKey) || 0;
      closeLossCounts.set(matchup.managerKey, current + 1);
    }
  }

  if (closeLossCounts.size === 0) return null;

  // Find manager with most close losses
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, count] of closeLossCounts) {
    if (count > maxCount) {
      maxCount = count;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  return {
    id: "heartbreaker",
    title: "HEARTBREAKER 💔",
    statPrimary: String(maxCount),
    statSecondary: "close losses",
    line: `${manager.name} lost ${maxCount} game${maxCount === 1 ? "" : "s"} by less than 5 points.`,
    managerKey: winnerKey,
  };
}

function computeBlowoutArtist(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
): MiniCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Count blowout wins (30+ point margin) per manager
  const blowoutCounts = new Map<string, number>();
  for (const matchup of weeklyMatchups) {
    if (matchup.won && matchup.margin >= 30) {
      const current = blowoutCounts.get(matchup.managerKey) || 0;
      blowoutCounts.set(matchup.managerKey, current + 1);
    }
  }

  if (blowoutCounts.size === 0) return null;

  // Find manager with most blowouts
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, count] of blowoutCounts) {
    if (count > maxCount) {
      maxCount = count;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  return {
    id: "blowout-artist",
    title: "BLOWOUT ARTIST 💥",
    statPrimary: String(maxCount),
    statSecondary: "blowouts",
    line: `${manager.name} won ${maxCount} game${maxCount === 1 ? "" : "s"} by 30+ points.`,
    managerKey: winnerKey,
  };
}

function computeGiantSlayer(
  weeklyMatchups: WeeklyMatchupDetail[],
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
): MiniCard | null {
  if (weeklyMatchups.length === 0 || seasonStats.length === 0) return null;

  // Find #1 seed per season
  const topSeedsBySeason = new Map<string, string>();
  for (const stat of seasonStats) {
    if (stat.rank === 1) {
      const existing = topSeedsBySeason.get(stat.season);
      if (!existing || stat.totalPF > (seasonStats.find((s) => s.season === stat.season && s.managerKey === existing)?.totalPF || 0)) {
        topSeedsBySeason.set(stat.season, stat.managerKey);
      }
    }
  }

  // Count wins vs #1 seed per manager
  const winsVsTopSeed = new Map<string, number>();
  for (const matchup of weeklyMatchups) {
    if (matchup.won) {
      const topSeed = topSeedsBySeason.get(matchup.season);
      if (topSeed && matchup.opponentKey === topSeed) {
        const current = winsVsTopSeed.get(matchup.managerKey) || 0;
        winsVsTopSeed.set(matchup.managerKey, current + 1);
      }
    }
  }

  if (winsVsTopSeed.size === 0) return null;

  // Find manager with most wins vs #1 seed
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, count] of winsVsTopSeed) {
    if (count > maxCount) {
      maxCount = count;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  return {
    id: "giant-slayer",
    title: "GIANT SLAYER 🗡️",
    statPrimary: String(maxCount),
    statSecondary: "wins vs champ",
    line: `${manager.name} beat the #1 seed ${maxCount} time${maxCount === 1 ? "" : "s"}.`,
    managerKey: winnerKey,
  };
}
