import type { SeasonStat, WeeklyMatchupDetail, HeroReceiptCard, ManagerRow } from "./types";
import {
  getPlayoffDroughtCopy,
  getBridesmaidCopy,
  getWoodenSpoonCopy,
  getPlayoffChokerCopy,
  getBiggestBlowoutCopy,
  getHeartbreakerCopy,
} from "./copyVariants";

const shouldDebugHeroReceipts =
  import.meta.env?.DEV &&
  typeof window !== "undefined" &&
  window.localStorage.getItem("debugHeroReceipts") === "1";

function logHeroReceiptSkip(label: string, reason: string) {
  if (!shouldDebugHeroReceipts) return;
  console.log(`[HeroReceipts] ${label} skipped: ${reason}`);
}

/** Prefer explicit regularSeasonRank; ignore legacy sentinel / missing. */
function regularSeasonRankOf(stat: SeasonStat): number | undefined {
  if (typeof stat.regularSeasonRank === "number" && stat.regularSeasonRank >= 1) {
    return stat.regularSeasonRank;
  }
  if (typeof stat.rank === "number" && stat.rank >= 1) {
    // Legacy demo / older payloads: rank was used as standing only when no outcome fields exist.
    if (stat.championshipWon != null || stat.runnerUp != null || stat.lastPlace != null || stat.finalFinish != null) {
      return undefined;
    }
    return stat.rank;
  }
  return undefined;
}

function isKnownChampion(stat: SeasonStat): boolean {
  return stat.championshipWon === true;
}

function isKnownRunnerUp(stat: SeasonStat): boolean {
  return stat.runnerUp === true;
}

function isKnownLastPlace(stat: SeasonStat): boolean {
  return stat.lastPlace === true;
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
  leagueId: string = "",
  emojiByKey: Record<string, string | null> = {},
): HeroReceiptCard[] {
  const receipts: HeroReceiptCard[] = [];
  const selectedMatchupKeys = new Set<string>();

  if (shouldDebugHeroReceipts && seasonStats.length === 0) {
    console.log("[HeroReceipts] seasonStats is empty");
  }
  if (shouldDebugHeroReceipts && weeklyMatchups.length === 0) {
    console.log("[HeroReceipts] weeklyMatchups is empty");
  }

  // Mid-season ranks are not season awards — only use completed regular seasons
  const completedSeasonStats = filterCompletedSeasonStats(seasonStats, weeklyMatchups);

  const woodenSpoon = computeWoodenSpoonMerchant(completedSeasonStats, managers, avatarByKey, leagueId, emojiByKey);
  if (woodenSpoon) receipts.push(woodenSpoon);
  else logHeroReceiptSkip("Wooden Spoon Merchant", "no qualifying last-place manager");

  const playoffDrought = computePlayoffDrought(seasonStats, managers, avatarByKey, leagueId, emojiByKey);
  if (playoffDrought) receipts.push(playoffDrought);
  else logHeroReceiptSkip("Playoff Drought", "no multi-season playoff drought found");

  const bridesmaid = computeBridesmaid(seasonStats, managers, avatarByKey, leagueId, emojiByKey);
  if (bridesmaid) receipts.push(bridesmaid);
  else logHeroReceiptSkip("Bridesmaid", "no 2+ runner-up finishes without a title");

  const missedIt = computeMissedItByThatMuch(completedSeasonStats, managers, avatarByKey, emojiByKey);
  if (missedIt) receipts.push(missedIt);
  else logHeroReceiptSkip("Missed It By That Much", "no non-playoff high scorer");

  const blowout = computeBiggestBlowout(weeklyMatchups, managers, avatarByKey, selectedMatchupKeys, emojiByKey);
  if (blowout) receipts.push(blowout);
  else logHeroReceiptSkip("Biggest Blowout", "no losing blowout found");

  const stoleOne = computeStoleOne(weeklyMatchups, managers, avatarByKey, emojiByKey);
  if (stoleOne) receipts.push(stoleOne);
  else logHeroReceiptSkip("Stole One", "no win found in weekly matchups");

  const fallOff = computeBiggestFallOff(seasonStats, managers, avatarByKey, emojiByKey);
  if (fallOff) receipts.push(fallOff);
  else logHeroReceiptSkip("Biggest Fall Off", "no multi-season rank drop found");

  const allGas = computeAllGasNoPlayoffs(completedSeasonStats, managers, avatarByKey, emojiByKey);
  if (allGas) receipts.push(allGas);
  else logHeroReceiptSkip("All Gas, No Playoffs", "no non-playoff high scorer found");

  const playoffChoker = computePlayoffChoker(completedSeasonStats, weeklyMatchups, managers, avatarByKey, leagueId, emojiByKey);
  if (playoffChoker) receipts.push(playoffChoker);
  else logHeroReceiptSkip("Playoff Choker", "no qualifying playoff choker found");

  const gameOfTheYear = computeGameOfTheYear(weeklyMatchups, managers, avatarByKey, selectedMatchupKeys, emojiByKey);
  if (gameOfTheYear) receipts.push(gameOfTheYear);
  else logHeroReceiptSkip("Game of the Year", "no qualifying high-scoring game found");

  const paperChampion = computePaperChampion(completedSeasonStats, managers, avatarByKey, emojiByKey);
  if (paperChampion) receipts.push(paperChampion);
  else logHeroReceiptSkip("Paper Champion", "no qualifying paper champion found");

  return receipts;
}

/** A season is "complete" for awards once we have matchups through regular season end. */
function isSeasonCompleteForAwards(
  season: string,
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
): boolean {
  const sample = seasonStats.find((s) => s.season === season);
  const regularEnd = Math.max(1, (sample?.playoffStartWeek ?? 15) - 1);
  const weeks = weeklyMatchups.filter((m) => m.season === season).map((m) => m.week);
  if (weeks.length > 0) {
    return Math.max(...weeks) >= regularEnd;
  }
  // No weekly rows for this season: treat as complete only if roster W–L looks like a full slate
  const stats = seasonStats.filter((s) => s.season === season);
  return stats.some((s) => s.wins + s.losses >= regularEnd);
}

function filterCompletedSeasonStats(
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
): SeasonStat[] {
  const seasons = [...new Set(seasonStats.map((s) => s.season))];
  const completed = new Set(
    seasons.filter((season) => isSeasonCompleteForAwards(season, seasonStats, weeklyMatchups)),
  );
  return seasonStats.filter((s) => completed.has(s.season));
}

const MIN_DROUGHT_SEASONS = 2;

function seasonToNumber(season?: string) {
  const n = Number(season);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Longest run of consecutive calendar seasons matching `isBadSeason`.
 * Gaps in season years break the streak (e.g. 2021, 2022, 2024 → max length 2).
 */
export function getLongestConsecutiveSeasonStreak(
  stats: SeasonStat[],
  isBadSeason: (stat: SeasonStat) => boolean,
) {
  const sorted = [...stats].sort((a, b) => seasonToNumber(a.season) - seasonToNumber(b.season));
  let best = { length: 0, start: "", end: "" };
  let current = { length: 0, start: "", end: "" };
  let prevYear = 0;

  for (const stat of sorted) {
    const year = seasonToNumber(stat.season);
    if (!year || !isBadSeason(stat)) {
      if (current.length > best.length) best = { ...current };
      current = { length: 0, start: "", end: "" };
      prevYear = 0;
      continue;
    }

    if (current.length === 0) {
      current = { length: 1, start: stat.season, end: stat.season };
    } else if (year === prevYear + 1) {
      current.length += 1;
      current.end = stat.season;
    } else {
      // Non-consecutive calendar year — start a new streak
      if (current.length > best.length) best = { ...current };
      current = { length: 1, start: stat.season, end: stat.season };
    }
    prevYear = year;
  }

  if (current.length > best.length) best = { ...current };
  return best;
}

function computePlayoffDrought(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  leagueId: string,
  emojiByKey: Record<string, string | null> = {},
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  const statsByManager = new Map<string, SeasonStat[]>();
  for (const stat of seasonStats) {
    const list = statsByManager.get(stat.managerKey) || [];
    list.push(stat);
    statsByManager.set(stat.managerKey, list);
  }

  let best: { managerKey: string; length: number; start: string; end: string } | null = null;

  for (const [managerKey, stats] of statsByManager) {
    if (stats.length < MIN_DROUGHT_SEASONS) continue;
    const streak = getLongestConsecutiveSeasonStreak(stats, (s) => !s.playoffQualified);
    if (streak.length >= MIN_DROUGHT_SEASONS) {
      if (
        !best ||
        streak.length > best.length ||
        (streak.length === best.length && seasonToNumber(streak.end) > seasonToNumber(best.end))
      ) {
        best = { managerKey, ...streak };
      }
    }
  }

  if (!best) return null;

  const manager = managers.find((m) => m.key === best.managerKey);
  if (!manager) return null;

  // Use copy variants system
  const copy = getPlayoffDroughtCopy(leagueId, best.length, best.start);
  if (!copy) return null; // Below threshold

  return {
    id: "playoff-drought",
    badge: "NEMESIS",
    title: copy.headline,
    name: manager.name,
    avatarUrl: avatarByKey[best.managerKey] ?? null,
    emoji: emojiByKey[best.managerKey] ?? null,
    primaryStat: {
      value: String(best.length),
      label: best.length === 1 ? "SEASON" : "SEASONS",
    },
    punchline: copy.punchline,
    lines: [
      { label: "Drought", value: best.start && best.end ? `${best.start}–${best.end}` : "—" },
    ],
    season: best.start && best.end ? `${best.end}–${best.start}` : undefined,
  };
}

/**
 * "Always the Bridesmaid" — 2+ known runner-up finishes, never a known championship.
 * Does not infer runner-up from rank === 2.
 */
function computeBridesmaid(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  leagueId: string,
  emojiByKey: Record<string, string | null> = {},
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  const statsByManager = new Map<string, SeasonStat[]>();
  for (const stat of seasonStats) {
    const list = statsByManager.get(stat.managerKey) || [];
    list.push(stat);
    statsByManager.set(stat.managerKey, list);
  }

  let best: { managerKey: string; runnerUpCount: number; seasons: string[] } | null = null;

  for (const [managerKey, stats] of statsByManager) {
    if (stats.some((s) => isKnownChampion(s))) continue;

    const runnerUps = stats.filter((s) => isKnownRunnerUp(s));
    if (runnerUps.length < 2) continue;

    if (
      !best ||
      runnerUps.length > best.runnerUpCount ||
      (runnerUps.length === best.runnerUpCount &&
        Math.max(...runnerUps.map((s) => seasonToNumber(s.season))) >
          Math.max(...best.seasons.map((s) => seasonToNumber(s))))
    ) {
      best = {
        managerKey,
        runnerUpCount: runnerUps.length,
        seasons: runnerUps.map((s) => s.season).sort((a, b) => seasonToNumber(a) - seasonToNumber(b)),
      };
    }
  }

  if (!best) return null;

  const manager = managers.find((m) => m.key === best.managerKey);
  if (!manager) return null;

  const copy = getBridesmaidCopy(leagueId, best.runnerUpCount);
  if (!copy) return null;

  return {
    id: "bridesmaid",
    badge: "NEMESIS",
    title: copy.headline,
    name: manager.name,
    avatarUrl: avatarByKey[best.managerKey] ?? null,
    emoji: emojiByKey[best.managerKey] ?? null,
    primaryStat: {
      value: String(best.runnerUpCount),
      label: best.runnerUpCount === 1 ? "RUNNER-UP" : "RUNNER-UPS",
    },
    punchline: copy.punchline,
    lines: [
      { label: "Titles", value: "0" },
      { label: "Finals", value: best.seasons.join(", ") },
    ],
    season:
      best.seasons.length > 1
        ? `${best.seasons[best.seasons.length - 1]}–${best.seasons[0]}`
        : best.seasons[0],
  };
}

function computeWoodenSpoonMerchant(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  leagueId: string,
  emojiByKey: Record<string, string | null> = {},
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // Only award when lastPlace is explicitly known — never infer from rank === leagueSize.
  const lastPlaceCounts = new Map<string, { count: number; seasons: string[] }>();

  for (const stat of seasonStats) {
    if (!isKnownLastPlace(stat)) continue;
    const existing = lastPlaceCounts.get(stat.managerKey) || { count: 0, seasons: [] };
    existing.count++;
    existing.seasons.push(stat.season);
    lastPlaceCounts.set(stat.managerKey, existing);
  }

  if (lastPlaceCounts.size === 0) return null;

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

  const copy = getWoodenSpoonCopy(leagueId, maxCount);

  return {
    id: "wooden-spoon",
    badge: "NEMESIS",
    title: copy.headline,
    name: manager.name,
    avatarUrl: avatarByKey[winner.key] ?? null,
    emoji: emojiByKey[winner.key] ?? null,
    primaryStat: {
      value: String(maxCount),
      label: maxCount === 1 ? "WOODEN SPOON" : "WOODEN SPOONS",
    },
    punchline: copy.punchline,
    lines: [{ label: "Seasons", value: winner.seasons.join(", ") }],
    season:
      winner.seasons.length > 1
        ? `${winner.seasons[winner.seasons.length - 1]}–${winner.seasons[0]}`
        : winner.seasons[0],
  };
}

function computeMissedItByThatMuch(
  seasonStats: SeasonStat[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  emojiByKey: Record<string, string | null> = {},
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
    emoji: emojiByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: Math.round(winner.totalPF).toLocaleString(),
      label: "PTS AND STILL MISSED",
    },
    punchline: `Scored ${Math.round(winner.totalPF).toLocaleString()} points and still didn't make playoffs.`,
    lines: [
      { label: "Rank", value: (() => {
        const r = regularSeasonRankOf(winner);
        return r != null ? `${r}${getOrdinalSuffix(r)}` : "—";
      })() },
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
  emojiByKey: Record<string, string | null> = {},
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
    emoji: emojiByKey[worst.managerKey] ?? null,
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
  emojiByKey: Record<string, string | null> = {},
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
    emoji: emojiByKey[winner.managerKey] ?? null,
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
  emojiByKey: Record<string, string | null> = {},
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

    for (let i = 1; i < stats.length; i++) {
      const from = stats[i]; // Older season
      const to = stats[i - 1]; // Newer season
      const fromRank = regularSeasonRankOf(from);
      const toRank = regularSeasonRankOf(to);
      if (fromRank == null || toRank == null) continue;
      const drop = toRank - fromRank;

      if (drop > maxDrop || (drop === maxDrop && (!winner || to.season > winner.toSeason))) {
        maxDrop = drop;
        winner = {
          managerKey,
          fromRank,
          toRank,
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
    emoji: emojiByKey[winner.managerKey] ?? null,
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
  emojiByKey: Record<string, string | null> = {},
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
    emoji: emojiByKey[winner.managerKey] ?? null,
    primaryStat: {
      value: Math.round(winner.totalPF).toLocaleString(),
      label: "PTS, NO PLAYOFFS",
    },
    punchline: `Scored ${Math.round(winner.totalPF).toLocaleString()} points and still missed the playoffs.`,
    lines: [
      { label: "Rank", value: (() => {
        const r = regularSeasonRankOf(winner);
        return r != null ? `${r}${getOrdinalSuffix(r)}` : "—";
      })() },
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
  if (rank === 1) return "1st seed";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}${getOrdinalSuffix(rank)}`;
}

function computePlayoffChoker(
  seasonStats: SeasonStat[],
  weeklyMatchups: WeeklyMatchupDetail[],
  managers: ManagerRow[],
  avatarByKey: Record<string, string | null>,
  leagueId: string,
  emojiByKey: Record<string, string | null> = {},
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
          
          const seed = regularSeasonRankOf(stat);
          if (seed == null) continue;
          const current = playoffLossesByManager.get(matchup.managerKey) || { 
            losses: 0, 
            season: matchup.season, 
            rank: seed,
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

  // Top seeds with multiple playoff losses. Do not claim a bye unless bracket data proves one
  // (this path only has weekly playoff matchups + seed — omit bye copy).
  let maxLosses = 0;
  let worst: { managerKey: string; losses: number; season: string; rank: number; countedWeeks: Array<{ week: number; won: boolean; points: number }> } | null = null;

  for (const [managerKey, data] of playoffLossesByManager) {
    if (data.rank <= 4 && data.rank >= 1 && data.losses >= 2 && data.losses > maxLosses) {
      maxLosses = data.losses;
      worst = { managerKey, ...data };
    }
  }

  if (!worst || maxLosses < 2) return null;

  const manager = managers.find((m) => m.key === worst.managerKey);
  if (!manager) return null;

  const rankDisplay = getRankLabel(worst.rank);
  const copy = getPlayoffChokerCopy(leagueId, maxLosses);

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
    title: copy?.headline ?? "PLAYOFF CHOKER 💔",
    name: manager.name,
    avatarUrl: avatarByKey[worst.managerKey] ?? null,
    emoji: emojiByKey[worst.managerKey] ?? null,
    primaryStat: {
      value: String(maxLosses),
      label: "PLAYOFF LOSSES",
    },
    punchline:
      copy?.punchline ??
      `${rankDisplay} seed. Lost ${maxLosses} playoff games. The choke is real.`,
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
  emojiByKey: Record<string, string | null> = {},
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
    emoji: emojiByKey[best.managerKey] ?? null,
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
  emojiByKey: Record<string, string | null> = {},
): HeroReceiptCard | null {
  if (seasonStats.length === 0) return null;

  // #1 regular-season seed who did not win — requires known championshipWon === false
  let best: SeasonStat | null = null;
  let bestSeason: string | null = null;

  for (const stat of seasonStats) {
    const seed = regularSeasonRankOf(stat);
    if (seed !== 1) continue;
    if (stat.championshipWon !== false) continue;
    if (!best || stat.totalPF > best.totalPF) {
      best = stat;
      bestSeason = stat.season;
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
    emoji: emojiByKey[best.managerKey] ?? null,
    primaryStat: {
      value: Math.round(best.totalPF).toLocaleString(),
      label: "PTS, NO TITLE",
    },
    punchline: `#1 regular-season seed. Did not win the championship.`,
    lines: [
      { label: "Regular Season Seed", value: getRankLabel(regularSeasonRankOf(best) ?? 1) },
      { label: "Record", value: `${best.wins}-${best.losses}` },
      { label: "Season", value: bestSeason },
      { label: "Championship", value: "No" },
    ],
    season: bestSeason,
  };
}
