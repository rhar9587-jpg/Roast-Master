// server/lib/cardCopy.ts
// Unified copy variant system for Your Season and Recap cards

export type CardType =
  // Your Season cards
  | "season_mvp"
  | "best_win"
  | "worst_enemy"
  | "choke_jobs"
  // Recap (League Autopsy) cards
  | "last_place"
  | "season_high"
  | "season_low"
  | "biggest_blowout"
  | "highest_loss";

export type CardCopyOutput = {
  tagline: string;
  isSpicy: boolean;
};

// Simple deterministic hash for consistent variant selection
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Copy library: safe and spicy tagline variants per card type
// Note: {name}, {opponent}, {team} are placeholders to be replaced at runtime
const CARD_COPY: Record<CardType, { safe: string[]; spicy: string[] }> = {
  // ═══════════════════════════════════════════════════════════════
  // YOUR SEASON CARDS
  // ═══════════════════════════════════════════════════════════════

  season_mvp: {
    safe: [
      "Carried the whole squad.",
      "The engine of your team.",
      "Your weekly cheat code.",
      "This one showed up.",
      "The real MVP. Literally.",
      "Worth every draft pick.",
    ],
    spicy: [
      "Held together a sinking ship.",
      "Did everything. You did nothing.",
      "The only reason you were competitive.",
      "One player, entire season.",
      "Imagine your team without them.",
      "They deserve a better manager.",
    ],
  },

  best_win: {
    safe: [
      "You cooked {opponent}.",
      "Dominant performance against {opponent}.",
      "{opponent} never stood a chance.",
      "A statement win over {opponent}.",
      "You owned {opponent} this week.",
      "{opponent} got the smoke.",
    ],
    spicy: [
      "You ended {opponent}'s whole career.",
      "{opponent} should delete their account.",
      "Mercy wasn't an option for {opponent}.",
      "{opponent} is still recovering.",
      "A public execution of {opponent}.",
      "{opponent} caught a stray. And another.",
    ],
  },

  worst_enemy: {
    safe: [
      "{name} owns you this season.",
      "{name} has your number.",
      "{name} is your kryptonite.",
      "You can't seem to beat {name}.",
      "{name} keeps taking your lunch money.",
      "Avoid {name} at all costs.",
    ],
    spicy: [
      "{name} lives rent-free in your head.",
      "You're {name}'s favorite victim.",
      "{name} treats you like a bye week.",
      "Free wins for {name}.",
      "{name} owns the deed to your team.",
      "{name} should send you a thank-you card.",
    ],
  },

  choke_jobs: {
    safe: [
      "You show up when it matters.",
      "Clutch when it counts.",
      "No choke jobs here.",
      "You finish what you start.",
      "Reliable under pressure.",
      "The anti-choker.",
    ],
    spicy: [
      "Ice in your veins. Allegedly.",
      "You actually won the games you should've.",
      "Not a fraud. Confirmed.",
      "Your team performs under pressure.",
      "Zero embarrassing losses. Rare.",
      "You don't fumble the bag.",
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // RECAP (LEAGUE AUTOPSY) CARDS
  // ═══════════════════════════════════════════════════════════════

  last_place: {
    safe: [
      "Someone had to finish here.",
      "The basement has a new tenant.",
      "Rock bottom found.",
      "Last place. First in our hearts.",
      "A rebuilding year. Forever.",
      "The toilet bowl awaits.",
    ],
    spicy: [
      "The league's designated punching bag.",
      "Fantasy's participation trophy winner.",
      "Tanking for draft picks. Hopefully.",
      "This is what giving up looks like.",
      "Delete the app. Start fresh.",
      "The wooden spoon is yours.",
    ],
  },

  season_high: {
    safe: [
      "This broke the league.",
      "An eruption of points.",
      "The scoreboard couldn't handle it.",
      "Peak performance. Literally.",
      "A week for the history books.",
      "The ceiling was reached.",
    ],
    spicy: [
      "This wasn't fair to anyone.",
      "Fantasy gods blessed this lineup.",
      "Opponent had no chance. None.",
      "This score hurt feelings.",
      "Straight-up disrespectful output.",
      "The league is still talking about this.",
    ],
  },

  season_low: {
    safe: [
      "Authorities were notified.",
      "A forgettable performance.",
      "The floor was found.",
      "This week never happened.",
      "Rock bottom. Then kept digging.",
      "Fantasy's darkest hour.",
    ],
    spicy: [
      "A crime against fantasy football.",
      "This lineup should be illegal.",
      "Someone check on this manager.",
      "This was intentional. Had to be.",
      "The bye week scored more.",
      "A new low for the league.",
    ],
  },

  biggest_blowout: {
    safe: [
      "This game was over at kickoff.",
      "A mismatch for the ages.",
      "One-sided doesn't cover it.",
      "The definition of a beatdown.",
      "They didn't even compete.",
      "A mercy rule was needed.",
    ],
    spicy: [
      "This was borderline bullying.",
      "One team showed up. One didn't.",
      "Fantasy's version of a war crime.",
      "Someone should've stopped this.",
      "The loser is still in therapy.",
      "A public humiliation.",
    ],
  },

  highest_loss: {
    safe: [
      "Did everything right. Still lost.",
      "The unluckiest loss of the year.",
      "Fantasy is cruel sometimes.",
      "Wrong week to go off.",
      "Points don't always mean wins.",
      "Bad luck personified.",
    ],
    spicy: [
      "The fantasy gods hate this team.",
      "Cursed. That's the only explanation.",
      "This loss should be expunged.",
      "The schedule makers did this.",
      "A tragedy in points form.",
      "This manager deserves an apology.",
    ],
  },
};

/**
 * Select a tagline for a card based on card type and league ID.
 * Uses deterministic selection so the same league always gets the same tagline.
 *
 * @param cardType - The type of card (e.g., "last_place", "worst_enemy")
 * @param leagueId - League ID for deterministic hash
 * @param spicy - If true, use spicy copy variants (premium toggle)
 */
export function selectCardCopy(
  cardType: CardType,
  leagueId: string,
  spicy = false
): CardCopyOutput {
  const variants = CARD_COPY[cardType];
  if (!variants) {
    return { tagline: "", isSpicy: spicy };
  }

  const pool = spicy ? variants.spicy : variants.safe;

  // Deterministic selection using league ID + card type hash
  const hashKey = `${leagueId}-card-${cardType}`;
  const hash = simpleHash(hashKey);
  const index = hash % pool.length;

  return {
    tagline: pool[index],
    isSpicy: spicy,
  };
}

/**
 * Get all taglines for a card type (useful for testing/preview)
 */
export function getTaglinesForCard(cardType: CardType, spicy = false): string[] {
  const variants = CARD_COPY[cardType];
  if (!variants) return [];
  return spicy ? variants.spicy : variants.safe;
}

/**
 * Replace placeholders in tagline with actual values
 * Placeholders: {name}, {opponent}, {team}
 */
export function interpolateTagline(
  tagline: string,
  replacements: Record<string, string>
): string {
  let result = tagline;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}
