/**
 * Copy Variants System for Fantasy Roast V1
 * 
 * This file contains:
 * - Variant pools for each card type
 * - Severity thresholds based on data
 * - Deterministic selection using hash(league_id + card_type)
 */

// ============================================
// Types
// ============================================

export type Severity = "mild" | "medium" | "nuclear";

export interface CopyVariant {
  headline: string;
  punchline: string;
  severity: Severity;
}

export interface CardCopyConfig {
  cardType: string;
  variants: CopyVariant[];
}

// ============================================
// Deterministic Hash Selection
// ============================================

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function selectVariant(
  leagueId: string,
  cardType: string,
  variants: CopyVariant[],
  maxSeverity: Severity
): CopyVariant {
  // Filter by max severity
  const severityOrder: Severity[] = ["mild", "medium", "nuclear"];
  const maxIndex = severityOrder.indexOf(maxSeverity);
  const eligible = variants.filter(v => severityOrder.indexOf(v.severity) <= maxIndex);
  
  if (eligible.length === 0) {
    return variants[0]; // Fallback to first variant
  }
  
  // Deterministic selection based on league_id + card_type
  const hash = simpleHash(`${leagueId}:${cardType}`);
  const index = hash % eligible.length;
  return eligible[index];
}

// ============================================
// Severity Threshold Helpers
// ============================================

export function getLandlordSeverity(totalWins: number): Severity | null {
  if (totalWins >= 50) return "nuclear";
  if (totalWins >= 30) return "medium";
  if (totalWins >= 15) return "mild";
  return null; // Don't render
}

export function getPlayoffDroughtSeverity(years: number): Severity | null {
  if (years >= 5) return "nuclear";
  if (years >= 3) return "medium";
  if (years === 2) return "mild";
  return null; // Don't render
}

export function getBridesmaidSeverity(runnerUpCount: number): Severity | null {
  if (runnerUpCount >= 4) return "nuclear";
  if (runnerUpCount >= 3) return "medium";
  if (runnerUpCount >= 2) return "mild";
  return null; // Don't render
}

export function getPlayoffChokerSeverity(lossesAfterBye: number): Severity | null {
  if (lossesAfterBye >= 2) return "nuclear";
  if (lossesAfterBye >= 1) return "medium";
  return "mild"; // Any top seed early exit
}

export function getBlowoutSeverity(margin: number): Severity | null {
  if (margin >= 50) return "nuclear";
  if (margin >= 30) return "medium";
  if (margin >= 20) return "mild";
  return null; // Don't render
}

export function getWorstEnemySeverity(opponentWins: number): Severity {
  if (opponentWins >= 3) return "medium";
  return "mild";
}

export function getChokeJobsSeverity(count: number): Severity {
  if (count >= 3) return "medium";
  return "mild";
}

// ============================================
// Variant Pools (30 variants across 13 card types)
// ============================================

export const LANDLORD_VARIANTS: CopyVariant[] = [
  {
    headline: "THE LANDLORD 👑",
    punchline: "Owns {victimCount} managers. Rent is due.",
    severity: "medium",
  },
  {
    headline: "THE LANDLORD 👑",
    punchline: "Collecting rent since day one. {victimCount} tenants and counting.",
    severity: "medium",
  },
  {
    headline: "THE LANDLORD 👑",
    punchline: "Dynasty. Receipts. Silence. Argue with the scoreboard.",
    severity: "nuclear",
  },
];

export const BIGGEST_VICTIM_VARIANTS: CopyVariant[] = [
  {
    headline: "BIGGEST VICTIM 😭",
    punchline: "Gets owned by {landlordCount} different managers. It's a lifestyle.",
    severity: "medium",
  },
  {
    headline: "BIGGEST VICTIM 😭",
    punchline: "Everyone's favorite opponent. {totalLosses} owned games.",
    severity: "medium",
  },
  {
    headline: "BIGGEST VICTIM 😭",
    punchline: "The league's punching bag. At least you're consistent.",
    severity: "medium",
  },
];

export const BIGGEST_BLOWOUT_VARIANTS: CopyVariant[] = [
  {
    headline: "BIGGEST BLOWOUT 💥",
    punchline: "Lost by {margin} points. Authorities have been notified.",
    severity: "nuclear",
  },
  {
    headline: "BIGGEST BLOWOUT 💥",
    punchline: "Got erased by {margin} points. This wasn't a game, it was a statement.",
    severity: "medium",
  },
];

export const PLAYOFF_CHOKER_VARIANTS: CopyVariant[] = [
  {
    headline: "PLAYOFF CHOKER 💔",
    punchline: "Had a bye week, then found a way to lose. The Chargering is real.",
    severity: "nuclear",
  },
  {
    headline: "PLAYOFF CHOKER 💔",
    punchline: "Top seed. First-round exit. A tradition unlike any other.",
    severity: "nuclear",
  },
  {
    headline: "PLAYOFF CHOKER 💔",
    punchline: "Dominated the regular season. Folded when it mattered.",
    severity: "medium",
  },
];

export const WOODEN_SPOON_VARIANTS: CopyVariant[] = [
  {
    headline: "WOODEN SPOON MERCHANT 🥄",
    punchline: "Finished last {count} time{s}. The basement is home.",
    severity: "medium",
  },
  {
    headline: "WOODEN SPOON MERCHANT 🥄",
    punchline: "{count} last-place finishes. Someone has to hold it down.",
    severity: "medium",
  },
];

export const PLAYOFF_DROUGHT_VARIANTS: CopyVariant[] = [
  {
    headline: "PLAYOFF DROUGHT 🏜️",
    punchline: "{years} years. {years} chances. Zero postseasons.",
    severity: "medium",
  },
  {
    headline: "PLAYOFF DROUGHT 🏜️",
    punchline: "The New York Jets of this league. {years} consecutive years of 'maybe next season.'",
    severity: "nuclear",
  },
  {
    headline: "PLAYOFF DROUGHT 🏜️",
    punchline: "Hasn't seen a playoff bracket since {startYear}. Still rebuilding.",
    severity: "medium",
  },
  {
    headline: "PLAYOFF DROUGHT 🏜️",
    punchline: "Generational suffering. Children born when they last made playoffs are now in middle school.",
    severity: "nuclear",
  },
];

export const BRIDESMAID_VARIANTS: CopyVariant[] = [
  {
    headline: "ALWAYS THE BRIDESMAID 💔",
    punchline: "{count} Finals trips. 0 rings. Classic.",
    severity: "mild",
  },
  {
    headline: "ALWAYS THE BRIDESMAID 💔",
    punchline: "Made it to the dance {count} times. Left alone every time.",
    severity: "mild",
  },
  {
    headline: "THE BUFFALO BILLS 💔",
    punchline: "{count} championship appearances. {count} losses. Brutal.",
    severity: "medium",
  },
  {
    headline: "RUNNER-UP ROYALTY 💔",
    punchline: "Nobody loses the big one like you do.",
    severity: "medium",
  },
  {
    headline: "CHAMPIONSHIP ALLERGIC 💔",
    punchline: "{count} trips to the Finals. Still ringless. At some point it's a choice.",
    severity: "nuclear",
  },
  {
    headline: "THE BIGGEST CHOKER 💔",
    punchline: "You've been 2nd place {count} times. That's not bad luck. That's a skill issue.",
    severity: "nuclear",
  },
];

export const HEARTBREAKER_VARIANTS: CopyVariant[] = [
  {
    headline: "HEARTBREAKER 💔",
    punchline: "{count} losses by less than 5 points. The fantasy gods are cruel.",
    severity: "medium",
  },
  {
    headline: "HEARTBREAKER 💔",
    punchline: "Lost {count} nail-biters. One play away, every time.",
    severity: "medium",
  },
];

export const YOUR_WORST_ENEMY_VARIANTS: CopyVariant[] = [
  {
    headline: "Your Worst Enemy",
    punchline: "{opponent} owns you this season.",
    severity: "medium",
  },
  {
    headline: "Your Worst Enemy",
    punchline: "{opponent} has your number. Time to study film.",
    severity: "mild",
  },
];

export const YOUR_CHOKE_JOBS_VARIANTS: CopyVariant[] = [
  {
    headline: "Your Choke Jobs",
    punchline: "{count} times you scored big and still lost. Pain.",
    severity: "medium",
  },
  {
    headline: "Your Choke Jobs",
    punchline: "You had this. {count} times you didn't finish.",
    severity: "mild",
  },
];

export const SEASON_SUMMARY_VARIANTS: CopyVariant[] = [
  {
    headline: "Season Summary",
    punchline: "Finished #{rank} with a {record} record.",
    severity: "mild",
  },
];

export const TEAM_MVP_VARIANTS: CopyVariant[] = [
  {
    headline: "Team MVP",
    punchline: "Carried the squad with {points} points.",
    severity: "mild",
  },
];

export const BIGGEST_WIN_VARIANTS: CopyVariant[] = [
  {
    headline: "Biggest Win",
    punchline: "Cooked {opponent} by {margin} points. Receipts attached.",
    severity: "mild",
  },
  {
    headline: "Biggest Win",
    punchline: "Dropped {margin} on {opponent}. They felt that one.",
    severity: "mild",
  },
];

// ============================================
// Copy Selection Functions
// ============================================

export function getLandlordCopy(
  leagueId: string,
  totalWins: number,
  victimCount: number,
  victimName?: string
): { headline: string; punchline: string } | null {
  const severity = getLandlordSeverity(totalWins);
  if (!severity) return null;
  
  const variant = selectVariant(leagueId, "landlord", LANDLORD_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline
      .replace("{victimCount}", String(victimCount))
      .replace("{victimName}", victimName ?? "opponents"),
  };
}

export function getPlayoffDroughtCopy(
  leagueId: string,
  years: number,
  startYear?: string
): { headline: string; punchline: string } | null {
  const severity = getPlayoffDroughtSeverity(years);
  if (!severity) return null;
  
  const variant = selectVariant(leagueId, "playoff-drought", PLAYOFF_DROUGHT_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline
      .replace(/{years}/g, String(years))
      .replace("{startYear}", startYear ?? "forever ago"),
  };
}

export function getBridesmaidCopy(
  leagueId: string,
  runnerUpCount: number
): { headline: string; punchline: string } | null {
  const severity = getBridesmaidSeverity(runnerUpCount);
  if (!severity) return null;
  
  const variant = selectVariant(leagueId, "bridesmaid", BRIDESMAID_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace(/{count}/g, String(runnerUpCount)),
  };
}

export function getPlayoffChokerCopy(
  leagueId: string,
  lossesAfterBye: number
): { headline: string; punchline: string } | null {
  const severity = getPlayoffChokerSeverity(lossesAfterBye);
  if (!severity) return null;
  
  const variant = selectVariant(leagueId, "playoff-choker", PLAYOFF_CHOKER_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace("{losses}", String(lossesAfterBye)),
  };
}

export function getBiggestBlowoutCopy(
  leagueId: string,
  margin: number
): { headline: string; punchline: string } | null {
  const severity = getBlowoutSeverity(margin);
  if (!severity) return null;
  
  const variant = selectVariant(leagueId, "biggest-blowout", BIGGEST_BLOWOUT_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace("{margin}", margin.toFixed(1)),
  };
}

export function getWoodenSpoonCopy(
  leagueId: string,
  count: number
): { headline: string; punchline: string } {
  const variant = selectVariant(leagueId, "wooden-spoon", WOODEN_SPOON_VARIANTS, "medium");
  return {
    headline: variant.headline,
    punchline: variant.punchline
      .replace("{count}", String(count))
      .replace("{s}", count === 1 ? "" : "s"),
  };
}

export function getHeartbreakerCopy(
  leagueId: string,
  count: number
): { headline: string; punchline: string } {
  const variant = selectVariant(leagueId, "heartbreaker", HEARTBREAKER_VARIANTS, "medium");
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace("{count}", String(count)),
  };
}

export function getBiggestVictimCopy(
  leagueId: string,
  landlordCount: number,
  totalLosses: number
): { headline: string; punchline: string } {
  const variant = selectVariant(leagueId, "biggest-victim", BIGGEST_VICTIM_VARIANTS, "medium");
  return {
    headline: variant.headline,
    punchline: variant.punchline
      .replace("{landlordCount}", String(landlordCount))
      .replace("{totalLosses}", String(totalLosses)),
  };
}

export function getWorstEnemyCopy(
  leagueId: string,
  opponentName: string,
  opponentWins: number
): { headline: string; punchline: string } {
  const severity = getWorstEnemySeverity(opponentWins);
  const variant = selectVariant(leagueId, "worst-enemy", YOUR_WORST_ENEMY_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace("{opponent}", opponentName),
  };
}

export function getChokeJobsCopy(
  leagueId: string,
  count: number
): { headline: string; punchline: string } {
  if (count === 0) {
    return {
      headline: "Your Choke Jobs",
      punchline: "Zero choke jobs. You show up when it matters.",
    };
  }
  
  const severity = getChokeJobsSeverity(count);
  const variant = selectVariant(leagueId, "choke-jobs", YOUR_CHOKE_JOBS_VARIANTS, severity);
  return {
    headline: variant.headline,
    punchline: variant.punchline.replace("{count}", String(count)),
  };
}

export function getBiggestWinCopy(
  leagueId: string,
  opponentName: string,
  margin: number
): { headline: string; punchline: string } {
  const variant = selectVariant(leagueId, "biggest-win", BIGGEST_WIN_VARIANTS, "mild");
  return {
    headline: variant.headline,
    punchline: variant.punchline
      .replace("{opponent}", opponentName)
      .replace("{margin}", margin.toFixed(1)),
  };
}
