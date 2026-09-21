/**
 * Re-export presentation hero helpers from shared (public recap + Weekly).
 * Kept for stable server import paths.
 */

export {
  closestGameHeroCandidate,
  publicRecapDisplayTitle,
  publicRecapHeroPriority,
  selectPublicRecapHero,
  selectPublicRecapSupportingMoments,
  selectWeeklyHero,
  selectWeeklySupportingMoments,
  weeklyHeroDisplayTitle,
  weeklyHeroPriority,
  partitionWeeklyRoastCards,
  type ClosestGameOpts,
  type PublicRecapHeroCard,
  type PublicRecapHeroMoment,
  type WeeklyCardPartition,
  type WeeklyHeroCard,
  type WeeklyHeroMoment,
} from "@shared/weeklyHero";
