/**
 * Presentation-only ranking of existing weekly roast cards for the public recap hero.
 * Does not alter the roast engine or invent metrics.
 */

export type PublicRecapHeroCard = {
  type?: string;
  title?: string;
  subtitle?: string;
  stat?: string;
  tagline?: string;
  meta?: Record<string, unknown>;
};

export type PublicRecapHeroMoment = {
  type: string;
  title: string;
  subtitle: string;
  stat?: string;
};

/** Lower number = stronger lead candidate. */
const HERO_TYPE_PRIORITY: Record<string, number> = {
  biggest_embarrassment: 1,
  closest_game: 2,
  fraud_watch: 3,
  top_dog: 4,
  carry_job: 5,
  worst_coaching: 6,
  lowest_scorer: 7,
  group_chat_drop: 90,
};

const SKIP_HERO_TYPES = new Set(["group_chat_drop"]);

export function publicRecapHeroPriority(type: string | undefined): number {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return 100;
  return HERO_TYPE_PRIORITY[key] ?? 50;
}

/** Presentation titles for the public page — does not change engine card titles upstream. */
export function publicRecapDisplayTitle(type: string, fallbackTitle?: string): string {
  const key = String(type || "").trim().toLowerCase();
  switch (key) {
    case "biggest_embarrassment":
      return "Murder Scene";
    case "closest_game":
      return "Narrow Escape";
    case "fraud_watch":
      return "Fraud Watch";
    case "top_dog":
      return "Top Dog";
    case "carry_job":
      return "Carry Job";
    case "worst_coaching":
      return "Bench Crimes";
    case "lowest_scorer":
      return "Straight to Jail";
    default:
      return String(fallbackTitle || "").trim() || "Recap";
  }
}

function normalizeCard(card: PublicRecapHeroCard): PublicRecapHeroMoment | null {
  const type = String(card.type || "").trim().toLowerCase();
  if (!type) return null;
  const subtitle = String(card.subtitle || card.tagline || "").trim();
  if (!subtitle && !card.stat) return null;
  const moment: PublicRecapHeroMoment = {
    type,
    title: publicRecapDisplayTitle(type, card.title),
    subtitle: subtitle || String(card.title || "").trim() || "League receipt",
  };
  if (card.stat) moment.stat = String(card.stat);
  return moment;
}

/**
 * Optional closest-game beat from narrative signals (already computed by the roast engine).
 * Presentation packaging only — scores/margin come from existing data.
 */
export function closestGameHeroCandidate(params: {
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  margin?: number | null;
}): PublicRecapHeroMoment | null {
  const margin = params.margin;
  if (margin == null || !Number.isFinite(margin) || margin < 0 || margin > 5) return null;
  const a = String(params.teamA || "").trim();
  const b = String(params.teamB || "").trim();
  if (!a || !b) return null;
  const scoreA = Number(params.scoreA);
  const scoreB = Number(params.scoreB);
  const hasScores = Number.isFinite(scoreA) && Number.isFinite(scoreB);
  return {
    type: "closest_game",
    title: publicRecapDisplayTitle("closest_game"),
    subtitle: hasScores
      ? `${a} ${scoreA.toFixed(1)} – ${scoreB.toFixed(1)} ${b}. Margin: ${margin.toFixed(1)}.`
      : `${a} vs ${b} was a ${margin.toFixed(1)}-pt nail-biter.`,
    ...(hasScores ? { stat: `${margin.toFixed(1)} pts` } : { stat: `${margin.toFixed(1)} pts` }),
  };
}

/**
 * Pick the strongest distinctive moment to lead the public recap.
 * Deterministic: type priority, then original order.
 */
export function selectPublicRecapHero(
  cards: PublicRecapHeroCard[],
  options?: {
    closestGame?: {
      teamA?: string;
      teamB?: string;
      scoreA?: number;
      scoreB?: number;
      margin?: number | null;
    } | null;
  },
): PublicRecapHeroMoment | null {
  const candidates: PublicRecapHeroMoment[] = [];
  for (const card of cards || []) {
    const moment = normalizeCard(card);
    if (!moment) continue;
    if (SKIP_HERO_TYPES.has(moment.type)) continue;
    candidates.push(moment);
  }
  const closest = options?.closestGame
    ? closestGameHeroCandidate({
        teamA: options.closestGame.teamA,
        teamB: options.closestGame.teamB,
        scoreA: options.closestGame.scoreA,
        scoreB: options.closestGame.scoreB,
        margin: options.closestGame.margin,
      })
    : null;
  if (closest) candidates.push(closest);

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const pa = publicRecapHeroPriority(a.type);
    const pb = publicRecapHeroPriority(b.type);
    if (pa !== pb) return pa - pb;
    return 0;
  });
  return candidates[0] ?? null;
}

/**
 * Supporting beats for the public page (exclude the hero; prefer distinctive types).
 */
export function selectPublicRecapSupportingMoments(
  cards: PublicRecapHeroCard[],
  hero: PublicRecapHeroMoment | null,
  limit = 3,
  options?: {
    closestGame?: {
      teamA?: string;
      teamB?: string;
      scoreA?: number;
      scoreB?: number;
      margin?: number | null;
    } | null;
  },
): PublicRecapHeroMoment[] {
  const max = Math.max(0, Math.min(3, Math.floor(limit)));
  if (max === 0) return [];

  const moments: PublicRecapHeroMoment[] = [];
  for (const card of cards || []) {
    const moment = normalizeCard(card);
    if (!moment) continue;
    if (SKIP_HERO_TYPES.has(moment.type)) continue;
    if (hero && moment.type === hero.type) continue;
    moments.push(moment);
  }
  const closest = options?.closestGame
    ? closestGameHeroCandidate({
        teamA: options.closestGame.teamA,
        teamB: options.closestGame.teamB,
        scoreA: options.closestGame.scoreA,
        scoreB: options.closestGame.scoreB,
        margin: options.closestGame.margin,
      })
    : null;
  if (closest && (!hero || hero.type !== "closest_game")) {
    moments.push(closest);
  }

  moments.sort((a, b) => publicRecapHeroPriority(a.type) - publicRecapHeroPriority(b.type));

  // Prefer 2–3; if only one remains, return it.
  const picked = moments.slice(0, max);
  return picked;
}
