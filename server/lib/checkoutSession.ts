/**
 * Pure Stripe Checkout session params for the league unlock.
 * Amount/currency come from STRIPE_PRICE_ID — never hardcoded here.
 */

import {
  unlockCheckoutDescription,
  unlockCheckoutSubmitHint,
} from "@shared/entitlementCopy";

export type CheckoutSessionCreateInput = {
  leagueId: string;
  leagueName?: string | null;
  priceId: string;
  clientUrl: string;
};

/** Params passed to stripe.checkout.sessions.create — mode/price unchanged. */
export function buildStripeCheckoutSessionParams(input: CheckoutSessionCreateInput) {
  const leagueId = String(input.leagueId || "").trim();
  const leagueName = String(input.leagueName || "").trim() || null;
  const clientUrl = String(input.clientUrl || "").replace(/\/$/, "");
  const description = unlockCheckoutDescription(leagueName);

  return {
    mode: "payment" as const,
    line_items: [{ price: input.priceId, quantity: 1 as const }],
    success_url: `${clientUrl}/league-history/dominance?league_id=${encodeURIComponent(
      leagueId,
    )}&tab=weekly&success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/league-history/dominance?league_id=${encodeURIComponent(
      leagueId,
    )}&tab=weekly&canceled=true`,
    customer_creation: "if_required" as const,
    metadata: {
      league_id: leagueId,
      product: "fantasy_roast_league_unlock",
      ...(leagueName ? { league_name: leagueName } : {}),
    },
    payment_intent_data: {
      description,
    },
    custom_text: {
      submit: {
        message: unlockCheckoutSubmitHint(),
      },
    },
  };
}
