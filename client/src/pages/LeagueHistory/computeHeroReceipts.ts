import type { SeasonStat, WeeklyMatchupDetail, HeroReceiptCard, ManagerRow } from "./types";

const shouldDebugHeroReceipts =
  import.meta.env?.DEV &&
  typeof window !== "undefined" &&
  window.localStorage.getItem("debugHeroReceipts") === "1";

function logHeroReceiptSkip(label: string, reason: string) {
  if (!shouldDebugHeroReceipts) return;
  console.log(`[HeroReceipts] ${label} skipped: ${reason}`);
}

/**
 * Generate canonical matchup key for deduplication.
 * Format: `${season}-${week}-${minKey}-${maxKey}`
 */
function getMatchupKey(matchup: WeeklyMatchupDetail): string {
  const minKey = matchup.managerKey < matchup.opponentKey ? matchup.managerKey : matchup.opponentKey;
  const maxKey = matchup.managerKey < matchup.opponentKey ? matchup.opponentKey : matchup.managerKey;
  return `${matchup.season}-${matchup.week}-${minKey}-${maxKey}`;
}

export function computeHeroReceipts(
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard[] {
  const receipts: HeroReceiptCard[] = [];
  const selectedMatchupKeys = new Set<string>();

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

  const blowout = computeBiggestBlowout(weeklyMatchups, managers, avatarByKey, selectedMatchupKeys);
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

  const playoffChoker = computePlayoffChoker(seasonStats, weeklyMatchups, managers, avatarByKey);
  if (playoffChoker) receipts.push(playoffChoker);
  else logHeroReceiptSkip("Playoff Choker", "no qualifying playoff choker found");

  const gameOfTheYear = computeGameOfTheYear(weeklyMatchups, managers, avatarByKey, selectedMatchupKeys);
  if (gameOfTheYear) receipts.push(gameOfTheYear);
  else logHeroReceiptSkip("Game of the Year", "no qualifying high-scoring game found");

  const paperChampion = computePaperChampion(seasonStats, managers, avatarByKey);
  if (paperChampion) receipts.push(paperChampion);
  else logHeroReceiptSkip("Paper Champion", "no qualifying paper champion found");

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
  selectedMatchupKeys: Set<string>,
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

  // Track this matchup to prevent duplication
  const matchupKey = getMatchupKey(worst);
  selectedMatchupKeys.add(matchupKey);

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
  if (rank == null || !Number.isFinite(rank) || rank < 1) return "—";
  if (rank === 1) return "Champion";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}${getOrdinalSuffix(rank)}`;
}

function computePlayoffChoker(
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0 || weeklyMatchups.length === 0) return null;

  // Build map of playoff week ranges per season
  const playoffStartBySeason = new Map<string, number>();
  const playoffEndBySeason = new Map<string, number>();
  for (const stat of seasonStats) {
    if (stat.playoffStartWeek !== undefined) {
      playoffStartBySeason.set(stat.season, stat.playoffStartWeek);
    }
    if (stat.playoffWeekEnd !== undefined) {
      playoffEndBySeason.set(stat.season, stat.playoffWeekEnd);
    }
  }

  // Track unique playoff games per manager to avoid double-counting
  const playoffGamesSeen = new Set<string>();
  const playoffLossesByManager = new Map<string, { 
    losses: number; 
    season: string; 
    rank: number;
    countedWeeks: Array<{ week: number; won: boolean; points: number }>;
  }>();
  
  // Count playoff losses for playoff-qualified teams
  for (const matchup of weeklyMatchups) {
    const playoffStart = playoffStartBySeason.get(matchup.season) ?? 15;
    const playoffEnd = playoffEndBySeason.get(matchup.season);
    
    // Check if this is a playoff week
    const isPlayoffWeek = matchup.week >= playoffStart && (playoffEnd === undefined || matchup.week <= playoffEnd);
    
    if (isPlayoffWeek && !matchup.won && Number.isFinite(matchup.opponentPoints)) {
      const stat = seasonStats.find(s => s.managerKey === matchup.managerKey && s.season === matchup.season);
      if (stat && stat.playoffQualified) {
        // Create unique key to avoid double-counting (each matchup appears twice in weeklyMatchups)
        const gameKey = `${matchup.season}-${matchup.week}-${matchup.managerKey}`;
        if (!playoffGamesSeen.has(gameKey)) {
          playoffGamesSeen.add(gameKey);
          
          const current = playoffLossesByManager.get(matchup.managerKey) || { 
            losses: 0, 
            season: matchup.season, 
            rank: stat.rank,
            countedWeeks: []
          };
          current.losses++;
          current.countedWeeks.push({
            week: matchup.week,
            won: matchup.won,
            points: matchup.points
          });
          playoffLossesByManager.set(matchup.managerKey, current);
        }
      }
    }
  }

  if (playoffLossesByManager.size === 0) return null;

  // Find manager with most playoff losses who had a bye (top 2-4 seeds typically get byes)
  let maxLosses = 0;
  let worst: { managerKey: string; losses: number; season: string; rank: number; countedWeeks: Array<{ week: number; won: boolean; points: number }> } | null = null;

  for (const [managerKey, data] of playoffLossesByManager) {
    // Only consider top 4 seeds (likely had bye) who lost multiple playoff games
    if (data.rank <= 4 && data.rank >= 1 && data.losses >= 2 && data.losses > maxLosses) {
      maxLosses = data.losses;
      worst = { managerKey, ...data };
    }
  }

  if (!worst || maxLosses < 2) return null;

  const manager = managers.find((m) => m.key === worst.managerKey);
  if (!manager) return null;

  const rankDisplay = getRankLabel(worst.rank);

  // Debug logging
  if (shouldDebugHeroReceipts) {
    const playoffStart = playoffStartBySeason.get(worst.season) ?? 15;
    const playoffEnd = playoffEndBySeason.get(worst.season);
    console.log(`[HeroReceipts] Playoff Choker:`, {
      season: worst.season,
      managerKey: worst.managerKey,
      rankDisplay,
      playoffStartWeek: playoffStart,
      playoffWeekEnd: playoffEnd,
      countedWeeks: worst.countedWeeks
    });
  }

  return {
    id: "playoff-choker",
    badge: "NEMESIS",
    title: "PLAYOFF CHOKER 💔",
    name: manager.name,
    avatarUrl: avatarByKey[worst.managerKey] ?? null,
    primaryStat: {
      value: String(maxLosses),
      label: "PLAYOFF LOSSES",
    },
    punchline: `Had a bye week, then lost ${maxLosses} playoff games. The choke is real.`,
    lines: [
      { label: "Regular Season Seed", value: rankDisplay },
      { label: "Season", value: worst.season },
    ],
    season: worst.season,
  };
}

function computeGameOfTheYear(
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  selectedMatchupKeys: Set<string>,
): HeroReceiptCard | null {
  if (weeklyMatchups.length === 0) return null;

  // Find matchup with highest combined score (points + opponentPoints)
  const MIN_COMBINED_SCORE = 260;
  let maxCombinedScore = 0;
  let best: WeeklyMatchupDetail | null = null;

  for (const matchup of weeklyMatchups) {
    const matchupKey = getMatchupKey(matchup);
    // Skip if this matchup was already selected by another card
    if (selectedMatchupKeys.has(matchupKey)) continue;

    const combinedScore = matchup.points + matchup.opponentPoints;
    if (combinedScore >= MIN_COMBINED_SCORE && combinedScore > maxCombinedScore) {
      maxCombinedScore = combinedScore;
      best = matchup;
    }
  }

  if (!best || maxCombinedScore < MIN_COMBINED_SCORE) return null;

  const manager = managers.find((m) => m.key === best.managerKey);
  const opponent = managers.find((m) => m.key === best.opponentKey);
  if (!manager || !opponent) return null;

  // Track this matchup to prevent duplication
  const matchupKey = getMatchupKey(best);
  selectedMatchupKeys.add(matchupKey);

  return {
    id: "game-of-the-year",
    badge: "EDGE",
    title: "GAME OF THE YEAR 🏆",
    name: manager.name,
    avatarUrl: avatarByKey[best.managerKey] ?? null,
    primaryStat: {
      value: Math.round(maxCombinedScore).toLocaleString(),
      label: "COMBINED SCORE",
    },
    punchline: `Combined ${Math.round(maxCombinedScore).toLocaleString()} points with ${opponent.name}. Absolute shootout.`,
    lines: [
      { label: "Week", value: String(best.week) },
      { label: "Score", value: `${best.points.toFixed(1)} - ${best.opponentPoints.toFixed(1)}` },
      { label: "Opponent", value: opponent.name },
    ],
    season: best.season,
  };
}

function computePaperChampion(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Find manager with rank 1 (best regular season) but check if they actually won
  // If there are multiple rank 1s or if rank 1 doesn't guarantee championship,
  // we'll look for rank 1 with highest totalPF who might have lost in playoffs
  
  // Group by season and find rank 1s
  const rank1BySeason = new Map<string, SeasonStat[]>();
  for (const stat of seasonStats) {
    if (stat.rank === 1) {
      const existing = rank1BySeason.get(stat.season) || [];
      existing.push(stat);
      rank1BySeason.set(stat.season, existing);
    }
  }

  // Find season with multiple rank 1s (tie) or rank 1 with most totalPF who might have choked
  let best: SeasonStat | null = null;
  let bestSeason: string | null = null;

  for (const [season, rank1s] of rank1BySeason) {
    if (rank1s.length > 1) {
      // Multiple rank 1s - pick the one with highest totalPF
      const top = rank1s.reduce((a, b) => a.totalPF > b.totalPF ? a : b);
      if (!best || top.totalPF > best.totalPF) {
        best = top;
        bestSeason = season;
      }
    } else if (rank1s.length === 1) {
      // Single rank 1 - check if they had high totalPF (might have choked in playoffs)
      const stat = rank1s[0];
      // Look for rank 1 who didn't win (heuristic: if there's a rank 2 with similar PF, they might have lost)
      const rank2 = seasonStats.find(s => s.season === season && s.rank === 2);
      if (rank2 && rank2.totalPF >= stat.totalPF * 0.95) {
        // Rank 2 was close, rank 1 might have choked
        if (!best || stat.totalPF > best.totalPF) {
          best = stat;
          bestSeason = season;
        }
      }
    }
  }

  // Fallback: rank 1 with highest totalPF across all seasons
  if (!best) {
    const allRank1s = seasonStats.filter(s => s.rank === 1);
    if (allRank1s.length > 0) {
      best = allRank1s.reduce((a, b) => a.totalPF > b.totalPF ? a : b);
      bestSeason = best.season;
    }
  }

  if (!best || !bestSeason) return null;

  const manager = managers.find((m) => m.key === best.managerKey);
  if (!manager) return null;

  return {
    id: "paper-champion",
    badge: "NEMESIS",
    title: "PAPER CHAMPION 📄",
    name: manager.name,
    avatarUrl: avatarByKey[best.managerKey] ?? null,
    primaryStat: {
      value: Math.round(best.totalPF).toLocaleString(),
      label: "PTS, NO TITLE",
    },
    punchline: `Best regular season (${getRankLabel(best.rank)} seed) but couldn't seal the deal.`,
    lines: [
      { label: "Record", value: `${best.wins}-${best.losses}` },
      { label: "Season", value: bestSeason },
      { label: "Playoff Teams", value: String(best.playoffTeams) },
    ],
    season: bestSeason,
  };
}
