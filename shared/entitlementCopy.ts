/**
 * Canonical paid entitlement copy — matches the real unlock model:
 * one-time Stripe `payment` for a single Sleeper `league_id`.
 * Not season-scoped. Not an account subscription. League mates are not auto-unlocked.
 */

export const ENTITLEMENT_PRICE = 2.99;
export const ENTITLEMENT_PRICE_LABEL = `$${ENTITLEMENT_PRICE.toFixed(2)}`;

/** Product name used in CTAs and paywalls (not Stripe Dashboard Product title). */
export const ENTITLEMENT_PRODUCT_NAME = "Fantasy Roast unlock";

/** Primary CTA verb + price. */
export const ENTITLEMENT_CTA_DEFAULT = "Unlock Fantasy Roast";

/**
 * Core benefits actually gated by league unlock.
 * Keep this list short and accurate — do not invent features.
 */
export const ENTITLEMENT_BENEFITS = [
  "Full Weekly roast and share cards",
  "Commissioner email tools",
  "League Receipts and history",
  "Season recap",
] as const;

export function entitlementScopePhrase(leagueName?: string | null): string {
  const name = String(leagueName || "").trim();
  return name ? `for ${name}` : "for this league";
}

/** Full statement: scope + one-time + price. */
export function unlockEntitlementStatement(leagueName?: string | null): string {
  return `Unlock Fantasy Roast ${entitlementScopePhrase(leagueName)} — one-time ${ENTITLEMENT_PRICE_LABEL}`;
}

/** Shorter headline when the price is shown separately. */
export function unlockEntitlementHeadline(leagueName?: string | null): string {
  return `Unlock Fantasy Roast ${entitlementScopePhrase(leagueName)}`;
}

/** Checkout / payment_intent description (app-controlled; does not change Stripe Price amount). */
export function unlockCheckoutDescription(leagueName?: string | null): string {
  const scope = entitlementScopePhrase(leagueName);
  return `Unlock Fantasy Roast ${scope} — one-time ${ENTITLEMENT_PRICE_LABEL}. Includes Weekly roast, share cards, Receipts, commissioner email, and season recap for this league.`;
}

export function unlockCheckoutSubmitHint(): string {
  return "One-time unlock for this Sleeper league. Not a subscription.";
}
