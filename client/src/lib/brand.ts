/**
 * Single source of truth for price, domain, and offer CTAs.
 * Import from here — do not hardcode $2.99 or fantasyroast.* in UI.
 */

export const BRAND_NAME = "Fantasy Roast";

/** Canonical public host (cards, watermarks, share footers). */
export const SITE_HOST = "fantasyroast.net";

export const SITE_URL = `https://${SITE_HOST}`;

/** One-time unlock price (USD). */
export const PRICE = 2.99;

export const PRICE_LABEL = `$${PRICE.toFixed(2)}`;

/** Primary upgrade CTA — receipts-first positioning. */
export function unlockCtaLabel(verb = "Unlock the receipts"): string {
  return `${verb} — ${PRICE_LABEL}`;
}

/** Shorter sticky / toolbar CTA when space is tight. */
export function unlockShortCta(): string {
  return `Unlock — ${PRICE_LABEL}`;
}

export const WATERMARK_DIAGONAL = `UNLOCK THE RECEIPTS — ${PRICE_LABEL} • ${SITE_HOST}`;

export const WATERMARK_FOOTER = `Unlock the receipts — ${PRICE_LABEL} • ${SITE_HOST}`;

export const OFFER = {
  unlockOnce: "Unlock once",
  noSubscription: "No subscription",
  moneyBack: "30-day money-back guarantee",
} as const;

export const SHARE_FOOTER = SITE_HOST;

export function getYoursLine(): string {
  return `Get yours: ${SITE_URL}`;
}
