import type { SeasonStat, WeeklyMatchupDetail, HeroReceiptCard, ManagerRow } from "./types";

const shouldDebugHeroReceipts =
  import.meta.env?.DEV &&
  typeof window !== "undefined" &&
  window.localStorage.getItem("debugHeroReceipts") === "1";

function logHeroReceiptSkip(label: string, reason: string) {
  if (!shouldDebugHeroReceipts) return;
  console.log(`[HeroReceipts] ${label} skipped: ${reason}`);
}

export function computeHeroReceipts(
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard[] {
  const receipts: HeroReceiptCard[] = [];

  if (shouldDebugHeroReceipts && seasonStats.length === 0) {
    console.log("[HeroReceipts] seasonStats is empty");
  }
  if (shouldDebugHeroReceipts && weeklyMatchups.length === 0) {
    console.log("[HeroReceipts] weeklyMatchups is empty");
  }

  const woodenSpoon = computeWoodenSpoonMerchant(seasonStats, managers, avatarByKey);
  if (woodenSpoon) receipts.push(woodenSpoon);
  else logHeroReceiptSkip("Wooden Spoon Merchant", "no qualifying last-place manager");

  const missedIt = computeMissedItByThatMuch(seasonStats, managers, avatarByKey);
  if (missedIt) receipts.push(missedIt);
  else logHeroReceiptSkip("Missed It By That Much", "no non-playoff high scorer");

  const blowout = computeBiggestBlowout(weeklyMatchups, managers, avatarByKey);
  if (blowout) receipts.push(blowout);
  else logHeroReceiptSkip("Biggest Blowout", "no losing blowout found");

  const stoleOne = computeStoleOne(weeklyMatchups, managers, avatarByKey);
  if (stoleOne) receipts.push(stoleOne);
  else logHeroReceiptSkip("Stole One", "no win found in weekly matchups");

  const fallOff = computeBiggestFallOff(seasonStats, managers, avatarByKey);
  if (fallOff) receipts.push(fallOff);
  else logHeroReceiptSkip("Biggest Fall Off", "no multi-season rank drop found");

  const allGas = computeAllGasNoPlayoffs(seasonStats, managers, avatarByKey);
  if (allGas) receipts.push(allGas);
  else logHeroReceiptSkip("All Gas, No Playoffs", "no non-playoff high scorer found");

  return receipts;
}

function computeWoodenSpoonMerchant(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Count last-place finishes per manager
  const lastPlaceCounts = new Map<string, { count: number; seasons: string[] }>();
  const leagueSizes = new Map<string, number>();

  // First pass: determine league size per season
  for (const stat of seasonStats) {
    const current = leagueSizes.get(stat.season) || 0;
    leagueSizes.set(stat.season, current + 1);
  }

  // Second pass: count last-place finishes
  for (const stat of seasonStats) {
    const leagueSize = leagueSizes.get(stat.season) || 0;
    if (stat.rank === leagueSize) {
      const existing = lastPlaceCounts.get(stat.managerKey) || { count: 0, seasons: [] };
      existing.count++;
      existing.seasons.push(stat.season);
      lastPlaceCounts.set(stat.managerKey, existing);
    }
  }

  if (lastPlaceCounts.size === 0) return null;

  // Find manager with most last-place finishes
  let maxCount = 0;
  let winner: { key: string; count: number; seasons: string[] } | null = null;

  for (const [key, data] of lastPlaceCounts) {
    if (data.count > maxCount || (data.count === maxCount && (!winner || data.seasons[0] > winner.seasons[0]))) {
      maxCount = data.count;
      winner = { key, ...data };
    }
  }

  if (!winner || maxCount === 0) return null;

  const manager = managers.find((m) => m.key === winner.key);
  if (!manager) return null;

  return {
    id: "wooden-spoon",
    badge: "NEMESIS",
    title: "WOODEN SPOON MERCHANT 🥄",
    name: manager.name,
    avatarUrl: avatarByKey[winner.key] ?? null,
    primaryStat: {
      value: String(maxCount),
      label: maxCount === 1 ? "WOODEN SPOON" : "WOODEN SPOONS",
    },
    punchline: `Finished last ${maxCount} time${maxCount === 1 ? "" : "s"}. The basement is home.`,
    lines: [
      { label: "Seasons", value: winner.seasons.join(", ") },
    ],
    season: winner.seasons.length > 1 ? `${winner.seasons[winner.seasons.length - 1]}–${winner.seasons[0]}` : winner.seasons[0],
  };
}

function computeMissedItByThatMuch(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Find manager with highest totalPF who didn't make playoffs
  let maxPF = 0;
  let winner: SeasonStat | null = null;

  for (const stat of seasonStats) {
    if (!stat.playoffQualified && stat.totalPF > maxPF) {
      maxPF = stat.totalPF;
      winner = stat;
    }
  }

  if (!winner) return null;

  const manager = managers.find((m) => m.key === winner.managerKey);
  if (!manager) return null;

  return {
    id: "missed-it",
    badge: "NEMESIS",
    title: "MISSED IT BY THAT MUCH 😬",
    name: manager.name,
    avatarUrl: avatarByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: Math.round(winner.totalPF).toLocaleString(),
      label: "PTS AND STILL MISSED",
    },
    punchline: `Scored ${Math.round(winner.totalPF).toLocaleString()} points and still didn't make playoffs.`,
    lines: [
      { label: "Rank", value: `${winner.rank}${getOrdinalSuffix(winner.rank)}` },
      { label: "Record", value: `${winner.wins}-${winner.losses}` },
      { label: "Playoff Cutoff", value: String(winner.playoffTeams) },
    ],
    season: winner.season,
  };
}

function computeBiggestBlowout(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Find largest margin (negative margin = loss)
  let maxMargin = 0;
  let worst: WeeklyMatchupDetail | null = null;

  for (const matchup of weeklyMatchups) {
    if (!matchup.won && Math.abs(matchup.margin) > Math.abs(maxMargin)) {
      maxMargin = matchup.margin;
      worst = matchup;
    }
  }

  if (!worst || worst.won) return null;

  const manager = managers.find((m) => m.key === worst.managerKey);
  const opponent = managers.find((m) => m.key === worst.opponentKey);
  if (!manager || !opponent) return null;

  return {
    id: "biggest-blowout",
    badge: "NEMESIS",
    title: "BIGGEST BLOWOUT 💥",
    name: manager.name,
    avatarUrl: avatarByKey[worst.managerKey] ?? null,
    primaryStat: {
      value: Math.abs(worst.margin).toFixed(1),
      label: "PTS LOSS",
    },
    punchline: `Lost by ${Math.abs(worst.margin).toFixed(1)} points to ${opponent.name}. Ouch.`,
    lines: [
      { label: "Week", value: String(worst.week) },
      { label: "Score", value: `${worst.points.toFixed(1)} - ${worst.opponentPoints.toFixed(1)}` },
      { label: "Opponent", value: opponent.name },
    ],
    season: worst.season,
  };
}

function computeStoleOne(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Find win with lowest points scored
  let minPoints = Infinity;
  let winner: WeeklyMatchupDetail | null = null;

  for (const matchup of weeklyMatchups) {
    if (matchup.won && matchup.points < minPoints) {
      minPoints = matchup.points;
      winner = matchup;
    }
  }

  if (!winner || !winner.won) return null;

  const manager = managers.find((m) => m.key === winner.managerKey);
  const opponent = managers.find((m) => m.key === winner.opponentKey);
  if (!manager || !opponent) return null;

  return {
    id: "stole-one",
    badge: "EDGE",
    title: "STOLE ONE 🎯",
    name: manager.name,
    avatarUrl: avatarByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: winner.points.toFixed(1),
      label: "PTS IN WIN",
    },
    punchline: `Won with just ${winner.points.toFixed(1)} points. Sometimes it's better to be lucky.`,
    lines: [
      { label: "Week", value: String(winner.week) },
      { label: "Opponent Score", value: winner.opponentPoints.toFixed(1) },
      { label: "Margin", value: `${Math.abs(winner.margin).toFixed(1)} pts` },
    ],
    season: winner.season,
  };
}

function computeBiggestFallOff(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Group stats by manager and sort by season
  const statsByManager = new Map<string, SeasonStat[]>();
  for (const stat of seasonStats) {
    const existing = statsByManager.get(stat.managerKey) || [];
    existing.push(stat);
    statsByManager.set(stat.managerKey, existing);
  }

  let maxDrop = 0;
  let winner: { managerKey: string; fromRank: number; toRank: number; fromSeason: string; toSeason: string } | null = null;

  for (const [managerKey, stats] of statsByManager) {
    if (stats.length < 2) continue;

    // Sort by season (newest first)
    stats.sort((a, b) => {
      const aYear = parseInt(a.season) || 0;
      const bYear = parseInt(b.season) || 0;
      return bYear - aYear;
    });

    // Compare consecutive seasons (older to newer to find fall offs)
    for (let i = 1; i < stats.length; i++) {
      const from = stats[i]; // Older season (better rank)
      const to = stats[i - 1]; // Newer season (worse rank)
      const drop = to.rank - from.rank; // Positive = dropped in rank (went from better to worse)

      if (drop > maxDrop || (drop === maxDrop && (!winner || to.season > winner.toSeason))) {
        maxDrop = drop;
        winner = {
          managerKey,
          fromRank: from.rank,
          toRank: to.rank,
          fromSeason: from.season,
          toSeason: to.season,
        };
      }
    }
  }

  if (!winner || maxDrop <= 0) return null;

  const manager = managers.find((m) => m.key === winner.managerKey);
  if (!manager) return null;

  return {
    id: "biggest-fall-off",
    badge: "NEMESIS",
    title: "BIGGEST FALL OFF 📉",
    name: manager.name,
    avatarUrl: avatarByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: `${getRankLabel(winner.fromRank)} → ${getRankLabel(winner.toRank)}`,
      label: "RANK DROP",
    },
    punchline: `Went from ${getRankLabel(winner.fromRank)} in ${winner.fromSeason} to ${getRankLabel(winner.toRank)} in ${winner.toSeason}.`,
    lines: [
      { label: "Drop", value: `${maxDrop} spots` },
      { label: "From", value: `${winner.fromSeason}: ${getRankLabel(winner.fromRank)}` },
      { label: "To", value: `${winner.toSeason}: ${getRankLabel(winner.toRank)}` },
    ],
    season: `${winner.toSeason}–${winner.fromSeason}`,
  };
}

function computeAllGasNoPlayoffs(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Find manager with highest totalPF in a single season who missed playoffs
  let maxPF = 0;
  let winner: SeasonStat | null = null;

  for (const stat of seasonStats) {
    if (!stat.playoffQualified && stat.totalPF > maxPF) {
      maxPF = stat.totalPF;
      winner = stat;
    }
  }

  if (!winner) return null;

  const manager = managers.find((m) => m.key === winner.managerKey);
  if (!manager) return null;

  return {
    id: "all-gas",
    badge: "NEMESIS",
    title: "ALL GAS, NO PLAYOFFS ⛽",
    name: manager.name,
    avatarUrl: avatarByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: Math.round(winner.totalPF).toLocaleString(),
      label: "PTS, NO PLAYOFFS",
    },
    punchline: `Scored ${Math.round(winner.totalPF).toLocaleString()} points and still missed the playoffs.`,
    lines: [
      { label: "Rank", value: `${winner.rank}${getOrdinalSuffix(winner.rank)}` },
      { label: "Record", value: `${winner.wins}-${winner.losses}` },
      { label: "Playoff Cutoff", value: String(winner.playoffTeams) },
    ],
    season: winner.season,
  };
}

function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function getRankLabel(rank: number): string {
  if (rank === 1) return "Champion";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}${getOrdinalSuffix(rank)}`;
}
