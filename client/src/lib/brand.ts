/**
 * Single source of truth for price, domain, and offer CTAs.
 * Import from here — do not hardcode $2.99 or fantasyroast.* in UI.
 *
 * Paid entitlement (see shared/entitlementCopy.ts): one-time unlock for one Sleeper league_id.
 */

import {
  ENTITLEMENT_BENEFITS,
  ENTITLEMENT_CTA_DEFAULT,
  ENTITLEMENT_PRICE,
  ENTITLEMENT_PRICE_LABEL,
  ENTITLEMENT_PRODUCT_NAME,
  unlockCheckoutDescription,
  unlockCheckoutSubmitHint,
  unlockEntitlementHeadline,
  unlockEntitlementStatement,
} from "@shared/entitlementCopy";

export const BRAND_NAME = "Fantasy Roast";

/** Canonical public host (cards, watermarks, share footers). */
export const SITE_HOST = "fantasyroast.net";

export const SITE_URL = `https://${SITE_HOST}`;

/** One-time unlock price (USD). */
export const PRICE = ENTITLEMENT_PRICE;

export const PRICE_LABEL = ENTITLEMENT_PRICE_LABEL;

export {
  ENTITLEMENT_BENEFITS,
  ENTITLEMENT_CTA_DEFAULT,
  ENTITLEMENT_PRODUCT_NAME,
  unlockCheckoutDescription,
  unlockCheckoutSubmitHint,
  unlockEntitlementHeadline,
  unlockEntitlementStatement,
};

/** Primary upgrade CTA — Fantasy Roast league unlock. */
export function unlockCtaLabel(verb = ENTITLEMENT_CTA_DEFAULT): string {
  return `${verb} — ${PRICE_LABEL}`;
}

/** Shorter sticky / toolbar CTA when space is tight. */
export function unlockShortCta(): string {
  return `Unlock Fantasy Roast — ${PRICE_LABEL}`;
}

export const WATERMARK_DIAGONAL = `UNLOCK FANTASY ROAST — ${PRICE_LABEL} • ${SITE_HOST}`;

export const WATERMARK_FOOTER = `Unlock Fantasy Roast — ${PRICE_LABEL} • ${SITE_HOST}`;

export const OFFER = {
  unlockOnce: "One-time unlock",
  noSubscription: "No subscription",
  moneyBack: "30-day money-back guarantee",
  /** Who/what the purchase covers — matches server entitlement key (league_id). */
  scopeNote: "Applies to this Sleeper league on this purchase",
} as const;

export const SHARE_FOOTER = SITE_HOST;

export function getYoursLine(): string {
  return `Get yours: ${SITE_URL}`;
}
