import { describe, expect, it } from "vitest";
import { buildStripeCheckoutSessionParams } from "./checkoutSession";
import {
  unlockCheckoutDescription,
  unlockCheckoutSubmitHint,
} from "@shared/entitlementCopy";

describe("buildStripeCheckoutSessionParams", () => {
  it("keeps mode payment, price id line item, and league_id metadata", () => {
    const params = buildStripeCheckoutSessionParams({
      leagueId: "1389437091309432832",
      leagueName: "NFL Downunder",
      priceId: "price_test_abc",
      clientUrl: "https://fantasyroast.net",
    });
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([{ price: "price_test_abc", quantity: 1 }]);
    expect(params.metadata.league_id).toBe("1389437091309432832");
    expect(params.metadata.league_name).toBe("NFL Downunder");
    expect(params.metadata.product).toBe("fantasy_roast_league_unlock");
    expect(params.success_url).toContain("success=true");
    expect(params.success_url).toContain("league_id=1389437091309432832");
    expect(params.success_url).toContain("tab=weekly");
    expect(params.cancel_url).toContain("canceled=true");
    expect(params.customer_creation).toBe("if_required");
    expect(params.payment_intent_data.description).toBe(
      unlockCheckoutDescription("NFL Downunder"),
    );
    expect(params.custom_text.submit.message).toBe(unlockCheckoutSubmitHint());
    // No amount/currency override — Stripe Price ID remains the source of truth.
    expect(JSON.stringify(params)).not.toContain("amount");
    expect(JSON.stringify(params)).not.toContain("price_data");
    expect(JSON.stringify(params).toLowerCase()).not.toContain("league history unlock");
  });

  it("still works without league name", () => {
    const params = buildStripeCheckoutSessionParams({
      leagueId: "lg1",
      priceId: "price_x",
      clientUrl: "https://example.com/",
    });
    expect(params.metadata.league_id).toBe("lg1");
    expect(params.metadata.league_name).toBeUndefined();
    expect(params.payment_intent_data.description).toContain("this league");
    expect(params.payment_intent_data.description).toContain("one-time $2.99");
  });
});
