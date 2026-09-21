/**
 * Presentation-only ranking of existing weekly roast cards.
 * Shared by public recap + in-app Weekly — does not alter the roast engine.
 */

export type WeeklyHeroCard = {
  type?: string;
  title?: string;
  subtitle?: string;
  stat?: string;
  tagline?: string;
  meta?: Record<string, unknown>;
};

export type WeeklyHeroMoment = {
  type: string;
  title: string;
  subtitle: string;
  stat?: string;
};

/** Aliases for public recap callers */
export type PublicRecapHeroCard = WeeklyHeroCard;
export type PublicRecapHeroMoment = WeeklyHeroMoment;

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

export function weeklyHeroPriority(type: string | undefined): number {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return 100;
  return HERO_TYPE_PRIORITY[key] ?? 50;
}

/** @deprecated Prefer weeklyHeroPriority — alias for public recap callers. */
export const publicRecapHeroPriority = weeklyHeroPriority;

/** Presentation titles — does not change engine card titles upstream. */
export function weeklyHeroDisplayTitle(type: string, fallbackTitle?: string): string {
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

/** @deprecated Prefer weeklyHeroDisplayTitle */
export const publicRecapDisplayTitle = weeklyHeroDisplayTitle;

function normalizeCard(card: WeeklyHeroCard): WeeklyHeroMoment | null {
  const type = String(card.type || "").trim().toLowerCase();
  if (!type) return null;
  const subtitle = String(card.subtitle || card.tagline || "").trim();
  if (!subtitle && !card.stat) return null;
  const moment: WeeklyHeroMoment = {
    type,
    title: weeklyHeroDisplayTitle(type, card.title),
    subtitle: subtitle || String(card.title || "").trim() || "League receipt",
  };
  if (card.stat) moment.stat = String(card.stat);
  return moment;
}

export function closestGameHeroCandidate(params: {
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  margin?: number | null;
}): WeeklyHeroMoment | null {
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
    title: weeklyHeroDisplayTitle("closest_game"),
    subtitle: hasScores
      ? `${a} ${scoreA.toFixed(1)} – ${scoreB.toFixed(1)} ${b}. Margin: ${margin.toFixed(1)}.`
      : `${a} vs ${b} was a ${margin.toFixed(1)}-pt nail-biter.`,
    stat: `${margin.toFixed(1)} pts`,
  };
}

export type ClosestGameOpts = {
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  margin?: number | null;
} | null;

/**
 * Pick the strongest distinctive moment to lead a weekly surface.
 * Deterministic: type priority, then original order.
 */
export function selectWeeklyHero(
  cards: WeeklyHeroCard[],
  options?: { closestGame?: ClosestGameOpts },
): WeeklyHeroMoment | null {
  const candidates: WeeklyHeroMoment[] = [];
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

  candidates.sort((a, b) => weeklyHeroPriority(a.type) - weeklyHeroPriority(b.type));
  return candidates[0] ?? null;
}

/** @deprecated Prefer selectWeeklyHero */
export const selectPublicRecapHero = selectWeeklyHero;

export function selectWeeklySupportingMoments(
  cards: WeeklyHeroCard[],
  hero: WeeklyHeroMoment | null,
  limit = 3,
  options?: { closestGame?: ClosestGameOpts },
): WeeklyHeroMoment[] {
  const max = Math.max(0, Math.min(4, Math.floor(limit)));
  if (max === 0) return [];

  const moments: WeeklyHeroMoment[] = [];
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

  moments.sort((a, b) => weeklyHeroPriority(a.type) - weeklyHeroPriority(b.type));
  return moments.slice(0, max);
}

/** @deprecated Prefer selectWeeklySupportingMoments */
export const selectPublicRecapSupportingMoments = selectWeeklySupportingMoments;

export type WeeklyCardPartition<T extends WeeklyHeroCard> = {
  hero: T | null;
  /** Hero may be a synthetic closest-game card not in the original array. */
  heroIsSynthetic: boolean;
  supporting: T[];
  remainder: T[];
};

/**
 * Partition engine cards for Weekly UI: one hero, 2–4 supporting, rest behind "see more".
 * Preserves original card objects for rendering existing share graphics.
 */
export function partitionWeeklyRoastCards<T extends WeeklyHeroCard>(
  cards: T[],
  options?: {
    closestGame?: ClosestGameOpts;
    supportingLimit?: number;
  },
): WeeklyCardPartition<T> {
  const supportingLimit = options?.supportingLimit ?? 3;
  const visual = (cards || []).filter((c) => {
    const t = String(c.type || "").trim().toLowerCase();
    return t && !SKIP_HERO_TYPES.has(t);
  });

  const heroMoment = selectWeeklyHero(visual, { closestGame: options?.closestGame });
  if (!heroMoment) {
    return { hero: null, heroIsSynthetic: false, supporting: [], remainder: [] };
  }

  let hero: T | null = null;
  let heroIsSynthetic = false;

  if (heroMoment.type === "closest_game") {
    const existing = visual.find(
      (c) => String(c.type || "").toLowerCase() === "closest_game",
    );
    if (existing) {
      hero = existing;
    } else {
      heroIsSynthetic = true;
      hero = {
        type: "closest_game",
        title: heroMoment.title,
        subtitle: heroMoment.subtitle,
        ...(heroMoment.stat ? { stat: heroMoment.stat } : {}),
        tagline: "Nail-biter.",
        meta: options?.closestGame
          ? {
              teamA: options.closestGame.teamA,
              teamB: options.closestGame.teamB,
              scoreA: options.closestGame.scoreA,
              scoreB: options.closestGame.scoreB,
              margin: options.closestGame.margin,
            }
          : undefined,
      } as unknown as T;
    }
  } else {
    hero =
      visual.find((c) => String(c.type || "").toLowerCase() === heroMoment.type) ?? null;
  }

  const remaining = visual.filter((c) => {
    if (!hero) return true;
    if (heroIsSynthetic) return true;
    return c !== hero && String(c.type || "").toLowerCase() !== String(hero.type || "").toLowerCase();
  });

  // Optionally inject synthetic closest into the pool for supporting if not hero
  const pool: T[] = [...remaining];
  if (
    !heroIsSynthetic &&
    heroMoment.type !== "closest_game" &&
    options?.closestGame
  ) {
    const closest = closestGameHeroCandidate({
      teamA: options.closestGame.teamA,
      teamB: options.closestGame.teamB,
      scoreA: options.closestGame.scoreA,
      scoreB: options.closestGame.scoreB,
      margin: options.closestGame.margin,
    });
    if (closest && !pool.some((c) => String(c.type).toLowerCase() === "closest_game")) {
      pool.push({
        type: "closest_game",
        title: closest.title,
        subtitle: closest.subtitle,
        ...(closest.stat ? { stat: closest.stat } : {}),
        tagline: "Nail-biter.",
        meta: {
          teamA: options.closestGame.teamA,
          teamB: options.closestGame.teamB,
          scoreA: options.closestGame.scoreA,
          scoreB: options.closestGame.scoreB,
          margin: options.closestGame.margin,
        },
      } as unknown as T);
    }
  }

  pool.sort(
    (a, b) =>
      weeklyHeroPriority(String(a.type)) - weeklyHeroPriority(String(b.type)),
  );

  const supporting = pool.slice(0, Math.max(0, Math.min(4, supportingLimit)));
  const remainder = pool.slice(supporting.length);

  return { hero, heroIsSynthetic, supporting, remainder };
}
