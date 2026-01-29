// server/lib/seasonTagline.ts
// Rule-based tagline generator for Season Summary card

export type TaglineInput = {
  wins: number;
  losses: number;
  ties: number;
  rank: number; // 1-indexed
  leagueSize: number;
  pointsFor: number;
  pointsAgainst: number;
  leagueId: string; // for deterministic hash
};

export type TaglineBucket =
  | "UNLUCKY_DISASTER"
  | "DOMINANT_CHAMP"
  | "DOMINANT_NO_TITLE"
  | "GOOD_SEASON"
  | "OVERACHIEVER"
  | "UNLUCKY_MID"
  | "COIN_FLIP"
  | "UNDERACHIEVER"
  | "BAD_SEASON"
  | "DISASTER"
  | "DEFAULT";

export type TaglineOutput = {
  bucket: TaglineBucket;
  tagline: string;
  isSpicy: boolean;
};

// Simple deterministic hash for consistent tagline selection
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Copy library: safe and spicy variants per bucket
const COPY_LIBRARY: Record<TaglineBucket, { safe: string[]; spicy: string[] }> = {
  UNLUCKY_DISASTER: {
    safe: [
      "Fantasy gods said no.",
      "Outscored everyone. Won nothing.",
      "More points than wins. Classic.",
      "The math didn't math.",
      "You deserved better. Seriously.",
      "Points don't lie. Your record does.",
    ],
    spicy: [
      "The universe owes you an apology.",
      "You played right. The schedule played you.",
      "High score. Low placement. Pain.",
      "Statistically tragic.",
      "The league's unluckiest manager.",
      "Schedule strength: impossible.",
    ],
  },
  DOMINANT_CHAMP: {
    safe: [
      "They'll be talking about this one.",
      "Championship. Receipts. Done.",
      "The crown fits.",
      "Dominant. Historic. Yours.",
      "This is what winning looks like.",
      "The blueprint worked.",
    ],
    spicy: [
      "Dynasty loaded.",
      "You didn't just win. You owned it.",
      "King of the league.",
      "A masterclass in fantasy domination.",
      "Built different. Proved it.",
      "Everyone else was playing for second.",
    ],
  },
  DOMINANT_NO_TITLE: {
    safe: [
      "Regular season merchant.",
      "14 weeks of dominance. Then... that.",
      "So close. So painful.",
      "Great record. Wrong result.",
      "The one that got away.",
      "Built to win. Forgot the playoffs.",
    ],
    spicy: [
      "All gas. No trophy.",
      "You peaked too early.",
      "The choke is real.",
      "Regular season hero. Playoff zero.",
      "Folded when it mattered.",
      "A cautionary tale.",
    ],
  },
  GOOD_SEASON: {
    safe: [
      "A season to remember.",
      "Consistent. Competitive. Solid.",
      "Top of the pack.",
      "Strong showing all year.",
      "You came to play.",
      "Built a winner. It showed.",
    ],
    spicy: [
      "You showed up.",
      "No complaints here.",
      "You belonged at the top.",
      "A certified contender.",
      "Respect earned.",
      "You did the work.",
    ],
  },
  OVERACHIEVER: {
    safe: [
      "Chaos magic worked.",
      "Survived on vibes alone.",
      "The schedule gods smiled.",
      "Punched above your weight.",
      "Defied the odds.",
      "Made it work somehow.",
    ],
    spicy: [
      "You have no business being here.",
      "The heist of the season.",
      "Lucky? Maybe. Here? Definitely.",
      "Smoke and mirrors. But it worked.",
      "Fantasy's favorite underdog.",
      "No one knows how you're here.",
    ],
  },
  UNLUCKY_MID: {
    safe: [
      "Unlucky, not untalented.",
      "Better than your record says.",
      "You played well. It didn't matter.",
      "Deserved more than this.",
      "The wrong side of variance.",
      "Points don't win. Matchups do.",
    ],
    spicy: [
      "The schedule did you dirty.",
      "Points say yes. Wins say no.",
      "Bad beats all season.",
      "Fantasy is cruel sometimes.",
      "Statistically snakebit.",
      "The unluckiest .500 team ever.",
    ],
  },
  COIN_FLIP: {
    safe: [
      "The definition of mid.",
      "Right down the middle.",
      "Not great. Not terrible.",
      "A coin flip all season.",
      "Balanced, as all things should be.",
      "Steady. Predictable. Mid.",
    ],
    spicy: [
      "Perfectly average. Aggressively fine.",
      ".500 is a lifestyle.",
      "Mediocrity, perfected.",
      "The most average season possible.",
      "Congratulations on being okay.",
      "Peak mid-table energy.",
    ],
  },
  UNDERACHIEVER: {
    safe: [
      "Won games. Lost the plot.",
      "The record lied.",
      "Wins without meaning.",
      "Looked good. Finished worse.",
      "Style over substance.",
      "Good enough to win. Not to matter.",
    ],
    spicy: [
      "All those wins and nothing to show.",
      "Paper tiger season.",
      "Stat padding champion.",
      "Won the battle. Lost the war.",
      "Impressive and irrelevant.",
      "Fake contender energy.",
    ],
  },
  BAD_SEASON: {
    safe: [
      "Rough year. It happens.",
      "A building season.",
      "Character-building stuff.",
      "Sometimes fantasy wins.",
      "A humbling experience.",
      "Next year is your year.",
    ],
    spicy: [
      "We don't talk about this one.",
      "Nowhere to go but up.",
      "At least you showed up.",
      "The league thanks you for your service.",
      "Participation trophy incoming.",
      "Delete the app. Start fresh.",
    ],
  },
  DISASTER: {
    safe: [
      "Burn it down. Start over.",
      "A season best forgotten.",
      "The only way is up.",
      "Tough to watch. Tougher to live.",
      "Lessons were learned. Hopefully.",
      "Rebuild mode: activated.",
    ],
    spicy: [
      "This never happened.",
      "Witness protection needed.",
      "Historic. For the wrong reasons.",
      "The league's favorite punching bag.",
      "A cautionary tale for future drafts.",
      "Toilet bowl champion.",
    ],
  },
  DEFAULT: {
    safe: [
      "A season in the books.",
      "Another year of fantasy.",
      "On to next year.",
    ],
    spicy: [
      "It was a season.",
      "You played. It's over.",
      "The grind continues.",
    ],
  },
};

/**
 * Classify a season into a tagline bucket based on performance metrics.
 * Buckets are evaluated in priority order — first match wins.
 */
export function classifyBucket(input: TaglineInput): TaglineBucket {
  const { wins, losses, ties, rank, leagueSize, pointsFor, pointsAgainst } = input;

  const totalGames = wins + losses + ties;
  if (totalGames === 0) return "DEFAULT";

  const winPct = wins / totalGames;
  const pfDiff = pointsFor - pointsAgainst;

  // Tier thresholds
  const topThird = Math.ceil(leagueSize / 3);
  const bottomThirdStart = Math.floor((leagueSize * 2) / 3) + 1;
  const lastPlace = leagueSize;

  // Priority 1: UNLUCKY_DISASTER - bad record but outscored opponents significantly
  if (winPct < 0.4 && pfDiff > 100) {
    return "UNLUCKY_DISASTER";
  }

  // Priority 2: DOMINANT_CHAMP - high win%, finished 1st
  if (winPct >= 0.75 && rank === 1) {
    return "DOMINANT_CHAMP";
  }

  // Priority 3: DOMINANT_NO_TITLE - high win%, but didn't win it all
  if (winPct >= 0.75 && rank > 1) {
    return "DOMINANT_NO_TITLE";
  }

  // Priority 4: GOOD_SEASON - solid record, top third placement
  if (winPct >= 0.6 && rank <= topThird) {
    return "GOOD_SEASON";
  }

  // Priority 5: OVERACHIEVER - bad record but high placement (chaos wizard)
  if (winPct < 0.5 && rank <= topThird) {
    return "OVERACHIEVER";
  }

  // Priority 6: UNLUCKY_MID - mediocre record but outscored opponents
  if (winPct >= 0.4 && winPct <= 0.55 && pfDiff > 50) {
    return "UNLUCKY_MID";
  }

  // Priority 7: COIN_FLIP - true .500 with balanced PF/PA
  if (winPct >= 0.45 && winPct <= 0.55 && Math.abs(pfDiff) < 50) {
    return "COIN_FLIP";
  }

  // Priority 8: DISASTER - last place always gets disaster treatment
  if (rank === lastPlace) {
    return "DISASTER";
  }

  // Priority 9: UNDERACHIEVER - good record but bad placement
  if (winPct >= 0.55 && rank >= bottomThirdStart) {
    return "UNDERACHIEVER";
  }

  // Priority 10: BAD_SEASON - below .450, bottom third
  if (winPct >= 0.35 && winPct < 0.45 && rank >= bottomThirdStart) {
    return "BAD_SEASON";
  }

  // Priority 11: DISASTER - very bad record
  if (winPct < 0.35) {
    return "DISASTER";
  }

  // Fallback
  return "DEFAULT";
}

/**
 * Select a tagline for a season based on performance metrics.
 * Uses deterministic selection based on leagueId hash.
 *
 * @param input - Season performance data
 * @param spicy - If true, use spicy copy variants (premium toggle)
 */
export function selectTagline(input: TaglineInput, spicy = false): TaglineOutput {
  const bucket = classifyBucket(input);
  const variants = COPY_LIBRARY[bucket];
  const pool = spicy ? variants.spicy : variants.safe;

  // Deterministic selection using league ID hash
  const hashKey = `${input.leagueId}-season-tagline-${bucket}`;
  const hash = simpleHash(hashKey);
  const index = hash % pool.length;

  return {
    bucket,
    tagline: pool[index],
    isSpicy: spicy,
  };
}

/**
 * Get all taglines for a bucket (useful for testing/preview)
 */
export function getTaglinesForBucket(
  bucket: TaglineBucket,
  spicy = false
): string[] {
  return spicy ? COPY_LIBRARY[bucket].spicy : COPY_LIBRARY[bucket].safe;
}
