import type { DominanceCellDTO, ManagerRow, RowTotal, WeeklyMatchupDetail, SeasonStat } from "./types";
import { fmtScore } from "./utils";

// Individual game detail for modal breakdowns
export type GameDetail = {
  season: string;
  week: number;
  opponent: string;
  yourPoints: number;
  theirPoints: number;
  margin: number;
  won: boolean;
};

export type MiniCard = {
  id: string;
  title: string;
  emoji: string; // Semantic emoji for the card type
  statPrimary: string;
  statSecondary?: string;
  metricLabel?: string; // Clarifying label under metric (e.g., "total losses", "H2H record")
  meta?: string;
  line: string;
  detail?: string;
  cellKey?: string;
  managerKey?: string;
  // Individual game breakdowns for modal display
  detailGames?: GameDetail[];
};

// Emoji mapping for all mini card types
const CARD_EMOJI: Record<string, string> = {
  "everybodys-victim": "😭",
  "point-diff-king": "📈",
  "punching-bag": "🥊",
  "untouchable": "🛡️",
  "rival-central": "⚔️",
  "your-biggest-win": "🏆",
  "your-choke-jobs": "😰",
  "your-favorite-victim": "👑",
  "your-kryptonite": "💀",
  "your-unfinished-business": "🔥",
  "most-played-opponent": "🔄",
  "closest-matchup": "⚖️",
  "most-even-rival": "🤝",
  "heartbreaker": "💔",
  "blowout-artist": "💥",
  "giant-slayer": "🗡️",
};

type TotalsByManagerEntry = {
  key: string;
  name: string;
  totalPF: number;
  totalPA: number;
};

// Credibility guardrails
const MIN_GAMES_FOR_STORYLINE = 5;
const MIN_GAMES_FOR_PERSONAL = 3; // Lowered from 5 to show more personal roasts
const MIN_WINS_FOR_UNTOUCHABLE = 3;
const SEVERE_OWNED_SCORE = 0.4;
const SEVERE_NEMESIS_SCORE = -0.4;
const MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG = 20;
const MAX_CHOKE_JOBS = 5; // Cap to avoid spam

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

/** Get H2H games between two managers from weeklyMatchups */
function getH2HGames(
  weeklyMatchups: WeeklyMatchupDetail[],
  managerA: string,
  managerB: string,
  managers: ManagerRow[],
  limit = 8
): GameDetail[] {
  const games = weeklyMatchups.filter(
    (m) => m.managerKey === managerA && m.opponentKey === managerB
  );
  return games
    .map((g) => {
      const oppManager = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: oppManager?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    })
    .sort((a, b) => Math.abs(b.margin) - Math.abs(a.margin)) // Most impactful games first
    .slice(0, limit);
}

/** Get all games for a manager from weeklyMatchups */
function getManagerGames(
  weeklyMatchups: WeeklyMatchupDetail[],
  managerKey: string,
  managers: ManagerRow[],
  filter: (m: WeeklyMatchupDetail) => boolean,
  sortFn: (a: GameDetail, b: GameDetail) => number,
  limit = 8
): GameDetail[] {
  const games = weeklyMatchups.filter(
    (m) => m.managerKey === managerKey && filter(m)
  );
  return games
    .map((g) => {
      const oppManager = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: oppManager?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    })
    .sort(sortFn)
    .slice(0, limit);
}

/** League Storylines: 5 mini cards from league-wide data. */
export function computeLeagueStorylines(
  allCells: DominanceCellDTO[],
  managers: ManagerRow[],
  rowTotals: Map<string, RowTotal>,
  totalsByManager: TotalsByManagerEntry[] | null,
  totalLeagueGames: number,
  weeklyMatchups: WeeklyMatchupDetail[] = []
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
    // Get their worst losses across all managers
    const detailGames = getManagerGames(
      weeklyMatchups,
      everybodyVictim.key,
      managers,
      (m) => !m.won,
      (a, b) => a.margin - b.margin, // Worst losses first (most negative margin)
      8
    );
    cards.push({
      id: "everybodys-victim",
      title: "EVERYBODY'S VICTIM",
      emoji: CARD_EMOJI["everybodys-victim"],
      statPrimary: String(everybodyVictim.count),
      metricLabel: everybodyVictim.count === 1 ? "owner" : "owners",
      line: "Everyone has receipts on this one.",
      detail: everybodyVictim.name,
      cellKey: everybodyVictim.cellKey,
      detailGames,
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
        emoji: CARD_EMOJI["point-diff-king"],
        statPrimary: `${sign}${Math.round(best.diff)}`,
        metricLabel: "point differential",
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
      // Get their biggest losses
      const detailGames = getManagerGames(
        weeklyMatchups,
        punchingBag.key,
        managers,
        (m) => !m.won,
        (a, b) => a.margin - b.margin, // Worst losses first
        8
      );
      cards.push({
        id: "punching-bag",
        title: "PUNCHING BAG",
        emoji: CARD_EMOJI["punching-bag"],
        statPrimary: String(punchingBag.losses),
        metricLabel: "total losses",
        line: "Took more L's than anyone.",
        detail: punchingBag.name,
        managerKey: punchingBag.key,
        detailGames,
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
    // Get their wins (they're untouchable so all games vs certain managers are wins)
    const detailGames = getManagerGames(
      weeklyMatchups,
      untouchable.key,
      managers,
      (m) => m.won,
      (a, b) => b.margin - a.margin, // Biggest wins first
      8
    );
    cards.push({
      id: "untouchable",
      title: "UNTOUCHABLE",
      emoji: CARD_EMOJI["untouchable"],
      statPrimary: String(untouchable.count),
      metricLabel: untouchable.count === 1 ? "perfect record" : "perfect records",
      line: "Never lost to these managers.",
      detail: untouchable.name,
      cellKey: untouchable.cellKey,
      detailGames,
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
      // Get games between these two rivals
      const detailGames = getH2HGames(weeklyMatchups, top.a, top.b, managers, 8);
      cards.push({
        id: "rival-central",
        title: "RIVAL CENTRAL",
        emoji: CARD_EMOJI["rival-central"],
        statPrimary: top.record,
        metricLabel: "H2H record",
        statSecondary: `Score ${fmtScore(top.score)}`,
        meta: `${games} games`,
        line: "Still can't settle this one.",
        detail: `${top.aName} vs ${top.bName}`,
        cellKey: `${top.a}-${top.b}`,
        detailGames,
      });
    }
  }

  return cards;
}

/** Your Roast: 5 mini cards. Only when viewerKey set; games >= MIN_GAMES_FOR_PERSONAL. */
export function computeYourRoast(
  viewerKey: string,
  allCells: DominanceCellDTO[],
  managers: ManagerRow[],
  weeklyMatchups: WeeklyMatchupDetail[] = []
): MiniCard[] {
  if (!viewerKey) return [];
  const cards: MiniCard[] = [];

  // YOUR BIGGEST WIN - largest margin victory
  const myWins = weeklyMatchups.filter(
    (m) => m.managerKey === viewerKey && m.won && m.margin > 0
  );
  const sortedWins = [...myWins].sort((a, b) => b.margin - a.margin);
  const biggestWin = sortedWins[0];
  if (biggestWin) {
    const opponent = managers.find((m) => m.key === biggestWin.opponentKey);
    // Show top 8 biggest wins
    const detailGames: GameDetail[] = sortedWins.slice(0, 8).map((g) => {
      const opp = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: opp?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    });
    cards.push({
      id: "your-biggest-win",
      title: "YOUR BIGGEST WIN",
      emoji: CARD_EMOJI["your-biggest-win"],
      statPrimary: `+${biggestWin.margin.toFixed(1)}`,
      metricLabel: "win margin",
      statSecondary: `Week ${biggestWin.week}`,
      meta: biggestWin.season,
      line: `Dropped ${biggestWin.points.toFixed(1)} on ${opponent?.name ?? "opponent"}.`,
      detail: opponent?.name,
      managerKey: viewerKey,
      detailGames,
    });
  }

  // YOUR CHOKE JOBS - losses where you beat the weekly median
  // Calculate weekly medians
  const weeklyScores = new Map<string, number[]>();
  for (const m of weeklyMatchups) {
    const key = `${m.season}-${m.week}`;
    const scores = weeklyScores.get(key) || [];
    scores.push(m.points);
    weeklyScores.set(key, scores);
  }

  // Find losses where you beat the weekly median, flag top-3 as nuclear
  const chokeJobs: Array<WeeklyMatchupDetail & { isNuclear: boolean; rank: number }> = [];
  for (const m of weeklyMatchups) {
    if (m.managerKey !== viewerKey || m.won) continue;

    const key = `${m.season}-${m.week}`;
    const scores = weeklyScores.get(key) || [];
    const sorted = [...scores].sort((a, b) => b - a);
    const medianIndex = Math.floor(sorted.length / 2);
    const median = sorted[medianIndex];
    const rank = sorted.indexOf(m.points) + 1; // 1-indexed rank
    const isTop3 = rank <= 3;

    if (m.points > median) {
      chokeJobs.push({ ...m, isNuclear: isTop3, rank });
    }
  }

  // Cap at MAX_CHOKE_JOBS, prioritize nuclear tier then highest score
  const cappedChokes = [...chokeJobs]
    .sort((a, b) => (b.isNuclear ? 1 : 0) - (a.isNuclear ? 1 : 0) || b.points - a.points)
    .slice(0, MAX_CHOKE_JOBS);

  if (cappedChokes.length > 0) {
    const nuclearCount = cappedChokes.filter((c) => c.isNuclear).length;
    const worstChoke = cappedChokes[0]; // Highest priority choke
    const opponent = managers.find((m) => m.key === worstChoke.opponentKey);

    // Dynamic punchline based on severity
    let punchline: string;
    if (nuclearCount > 0 && worstChoke.isNuclear) {
      punchline = nuclearCount === 1
        ? `Top ${worstChoke.rank} scorer. Still lost to ${opponent?.name ?? "opponent"}.`
        : `${nuclearCount} times you were a top 3 scorer and still lost.`;
    } else {
      punchline = cappedChokes.length === 1
        ? `Beat half the league and lost to ${opponent?.name ?? "opponent"}.`
        : `${cappedChokes.length} times you beat half the league and lost.`;
    }

    // Convert choke jobs to GameDetail format
    const detailGames: GameDetail[] = cappedChokes.map((g) => {
      const opp = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: opp?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    });

    cards.push({
      id: "your-choke-jobs",
      title: "YOUR CHOKE JOBS",
      emoji: CARD_EMOJI["your-choke-jobs"],
      statPrimary: String(cappedChokes.length),
      metricLabel: cappedChokes.length === 1 ? "choke job" : "choke jobs",
      statSecondary: nuclearCount > 0 ? `${nuclearCount} nuclear` : undefined,
      meta: `Worst: ${worstChoke.points.toFixed(1)} pts (Week ${worstChoke.week})`,
      line: punchline,
      detail: opponent?.name,
      managerKey: viewerKey,
      detailGames,
    });
  }

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
    const detailGames = getH2HGames(weeklyMatchups, viewerKey, bestOwned.b, managers, 8);
    cards.push({
      id: "your-favorite-victim",
      title: "YOUR FAVORITE VICTIM",
      emoji: CARD_EMOJI["your-favorite-victim"],
      statPrimary: bestOwned.record,
      metricLabel: "H2H record",
      statSecondary: `Score ${fmtScore(bestOwned.score)}`,
      meta: `${bestOwned.games} games`,
      line: "Rent is always due.",
      detail: bestOwned.bName,
      cellKey: `${bestOwned.a}-${bestOwned.b}`,
      detailGames,
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
    const detailGames = getH2HGames(weeklyMatchups, viewerKey, worstNemesis.b, managers, 8);
    cards.push({
      id: "your-kryptonite",
      title: "YOUR KRYPTONITE",
      emoji: CARD_EMOJI["your-kryptonite"],
      statPrimary: worstNemesis.record,
      metricLabel: "H2H record",
      statSecondary: `Score ${fmtScore(worstNemesis.score)}`,
      meta: `${worstNemesis.games} games`,
      line: "They cook you every time.",
      detail: worstNemesis.bName,
      cellKey: `${worstNemesis.a}-${worstNemesis.b}`,
      detailGames,
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
    const otherKey = longestRival.a === viewerKey ? longestRival.b : longestRival.a;
    const detailGames = getH2HGames(weeklyMatchups, viewerKey, otherKey, managers, 8);
    cards.push({
      id: "your-unfinished-business",
      title: "YOUR UNFINISHED BUSINESS",
      emoji: CARD_EMOJI["your-unfinished-business"],
      statPrimary: longestRival.record,
      metricLabel: "H2H record",
      statSecondary: `Score ${fmtScore(longestRival.score)}`,
      meta: `${longestRival.games} games`,
      line: "This rivalry runs deep.",
      detail: other,
      cellKey: `${longestRival.a}-${longestRival.b}`,
      detailGames,
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
      const otherKey = mostPlayed.a === viewerKey ? mostPlayed.b : mostPlayed.a;
      const detailGames = getH2HGames(weeklyMatchups, viewerKey, otherKey, managers, 8);
      cards.push({
        id: "most-played-opponent",
        title: "MOST PLAYED OPPONENT",
        emoji: CARD_EMOJI["most-played-opponent"],
        statPrimary: mostPlayed.record,
        metricLabel: "H2H record",
        statSecondary: `Score ${fmtScore(mostPlayed.score)}`,
        meta: `${mostPlayed.games} games`,
        line: "You see this one a lot.",
        detail: other,
        cellKey: `${mostPlayed.a}-${mostPlayed.b}`,
        detailGames,
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
      const otherKey = closest.a === viewerKey ? closest.b : closest.a;
      const detailGames = getH2HGames(weeklyMatchups, viewerKey, otherKey, managers, 8);
      cards.push({
        id: "closest-matchup",
        title: "CLOSEST MATCHUP",
        emoji: CARD_EMOJI["closest-matchup"],
        statPrimary: closest.record,
        metricLabel: "H2H record",
        statSecondary: `Score ${fmtScore(closest.score)}`,
        meta: `${closest.games} games`,
        line: "Too close to call.",
        detail: other,
        cellKey: `${closest.a}-${closest.b}`,
        detailGames,
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
      const otherKey = mostEven.a === viewerKey ? mostEven.b : mostEven.a;
      const detailGames = getH2HGames(weeklyMatchups, viewerKey, otherKey, managers, 8);
      cards.push({
        id: "most-even-rival",
        title: "MOST EVEN RIVAL",
        emoji: CARD_EMOJI["most-even-rival"],
        statPrimary: mostEven.record,
        metricLabel: "H2H record",
        statSecondary: `Score ${fmtScore(mostEven.score)}`,
        meta: `${mostEven.games} games`,
        line: "Dead even. No one owns anyone.",
        detail: other,
        cellKey: `${mostEven.a}-${mostEven.b}`,
        detailGames,
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

  // Collect close losses (<5 points) per manager with game details
  const closeLossGames = new Map<string, WeeklyMatchupDetail[]>();
  for (const matchup of weeklyMatchups) {
    if (!matchup.won && Math.abs(matchup.margin) < 5) {
      const games = closeLossGames.get(matchup.managerKey) || [];
      games.push(matchup);
      closeLossGames.set(matchup.managerKey, games);
    }
  }

  if (closeLossGames.size === 0) return null;

  // Find manager with most close losses
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, games] of closeLossGames) {
    if (games.length > maxCount) {
      maxCount = games.length;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  // Get the games and convert to GameDetail format, sorted by closest margin
  const games = closeLossGames.get(winnerKey) || [];
  const detailGames: GameDetail[] = games
    .map((g) => {
      const oppManager = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: oppManager?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    })
    .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin)) // Closest first
    .slice(0, 8); // Limit to 8 games

  return {
    id: "heartbreaker",
    title: "HEARTBREAKER",
    emoji: CARD_EMOJI["heartbreaker"],
    statPrimary: String(maxCount),
    metricLabel: maxCount === 1 ? "close loss" : "close losses",
    line: `Lost by less than 5 points ${maxCount} time${maxCount === 1 ? "" : "s"}.`,
    detail: manager.name,
    managerKey: winnerKey,
    detailGames,
  };
}

function computeBlowoutArtist(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
): MiniCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Collect blowout wins (30+ point margin) per manager with game details
  const blowoutGames = new Map<string, WeeklyMatchupDetail[]>();
  for (const matchup of weeklyMatchups) {
    if (matchup.won && matchup.margin >= 30) {
      const games = blowoutGames.get(matchup.managerKey) || [];
      games.push(matchup);
      blowoutGames.set(matchup.managerKey, games);
    }
  }

  if (blowoutGames.size === 0) return null;

  // Find manager with most blowouts
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, games] of blowoutGames) {
    if (games.length > maxCount) {
      maxCount = games.length;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  // Get the games and convert to GameDetail format, sorted by largest margin
  const games = blowoutGames.get(winnerKey) || [];
  const detailGames: GameDetail[] = games
    .map((g) => {
      const oppManager = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: oppManager?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    })
    .sort((a, b) => b.margin - a.margin) // Largest margin first
    .slice(0, 8); // Limit to 8 games

  return {
    id: "blowout-artist",
    title: "BLOWOUT ARTIST",
    emoji: CARD_EMOJI["blowout-artist"],
    statPrimary: String(maxCount),
    metricLabel: maxCount === 1 ? "blowout win" : "blowout wins",
    line: `Won by 30+ points ${maxCount} time${maxCount === 1 ? "" : "s"}.`,
    detail: manager.name,
    managerKey: winnerKey,
    detailGames,
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

  // Collect wins vs #1 seed per manager with game details
  const giantSlayerGames = new Map<string, WeeklyMatchupDetail[]>();
  for (const matchup of weeklyMatchups) {
    if (matchup.won) {
      const topSeed = topSeedsBySeason.get(matchup.season);
      if (topSeed && matchup.opponentKey === topSeed) {
        const games = giantSlayerGames.get(matchup.managerKey) || [];
        games.push(matchup);
        giantSlayerGames.set(matchup.managerKey, games);
      }
    }
  }

  if (giantSlayerGames.size === 0) return null;

  // Find manager with most wins vs #1 seed
  let maxCount = 0;
  let winnerKey: string | null = null;
  for (const [key, games] of giantSlayerGames) {
    if (games.length > maxCount) {
      maxCount = games.length;
      winnerKey = key;
    }
  }

  if (!winnerKey || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winnerKey);
  if (!manager) return null;

  // Get the games and convert to GameDetail format
  const games = giantSlayerGames.get(winnerKey) || [];
  const detailGames: GameDetail[] = games
    .map((g) => {
      const oppManager = managers.find((m) => m.key === g.opponentKey);
      return {
        season: g.season,
        week: g.week,
        opponent: oppManager?.name || g.opponentKey,
        yourPoints: g.points,
        theirPoints: g.opponentPoints,
        margin: g.margin,
        won: g.won,
      };
    })
    .sort((a, b) => b.margin - a.margin) // Largest win first
    .slice(0, 8); // Limit to 8 games

  return {
    id: "giant-slayer",
    title: "GIANT SLAYER",
    emoji: CARD_EMOJI["giant-slayer"],
    statPrimary: String(maxCount),
    metricLabel: maxCount === 1 ? "upset win" : "upset wins",
    line: `Beat the #1 seed ${maxCount} time${maxCount === 1 ? "" : "s"}.`,
    detail: manager.name,
    managerKey: winnerKey,
    detailGames,
  };
}
