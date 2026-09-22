import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_BENEFITS,
  ENTITLEMENT_CTA_DEFAULT,
  ENTITLEMENT_PRICE,
  ENTITLEMENT_PRICE_LABEL,
  ENTITLEMENT_PRODUCT_NAME,
  unlockCheckoutDescription,
  unlockEntitlementHeadline,
  unlockEntitlementStatement,
} from "@shared/entitlementCopy";
import {
  OFFER,
  PRICE,
  PRICE_LABEL,
  unlockCtaLabel,
  unlockShortCta,
  WATERMARK_DIAGONAL,
  WATERMARK_FOOTER,
} from "./brand";

describe("canonical entitlement copy", () => {
  it("matches league-scoped one-time $2.99 unlock", () => {
    expect(ENTITLEMENT_PRICE).toBe(2.99);
    expect(ENTITLEMENT_PRICE_LABEL).toBe("$2.99");
    expect(PRICE).toBe(2.99);
    expect(PRICE_LABEL).toBe("$2.99");
    expect(ENTITLEMENT_PRODUCT_NAME.toLowerCase()).toContain("fantasy roast");
    expect(ENTITLEMENT_CTA_DEFAULT).toBe("Unlock Fantasy Roast");
    expect(unlockEntitlementStatement("NFL Downunder")).toBe(
      "Unlock Fantasy Roast for NFL Downunder — one-time $2.99",
    );
    expect(unlockEntitlementStatement()).toBe(
      "Unlock Fantasy Roast for this league — one-time $2.99",
    );
    expect(unlockEntitlementHeadline("NFL Downunder")).toBe(
      "Unlock Fantasy Roast for NFL Downunder",
    );
    expect(unlockEntitlementStatement("NFL Downunder").toLowerCase()).toContain("one-time");
    expect(OFFER.unlockOnce.toLowerCase()).toContain("one-time");
    expect(OFFER.noSubscription.toLowerCase()).toContain("subscription");
  });

  it("removes legacy League History Unlock / receipts-only CTA naming", () => {
    expect(unlockCtaLabel()).toBe("Unlock Fantasy Roast — $2.99");
    expect(unlockShortCta()).toBe("Unlock Fantasy Roast — $2.99");
    expect(unlockCtaLabel().toLowerCase()).not.toContain("league history");
    expect(unlockCtaLabel().toLowerCase()).not.toContain("unlock the receipts");
    expect(WATERMARK_DIAGONAL.toLowerCase()).not.toContain("unlock the receipts");
    expect(WATERMARK_FOOTER.toLowerCase()).not.toContain("unlock the receipts");
    expect(unlockCheckoutDescription("NFL Downunder").toLowerCase()).not.toContain(
      "league history unlock",
    );
  });

  it("lists a consistent small set of included benefits", () => {
    expect(ENTITLEMENT_BENEFITS.length).toBeGreaterThanOrEqual(3);
    expect(ENTITLEMENT_BENEFITS.length).toBeLessThanOrEqual(5);
    expect(ENTITLEMENT_BENEFITS).toContain("Full Weekly roast and share cards");
    expect(ENTITLEMENT_BENEFITS).toContain("League Receipts and history");
    expect(ENTITLEMENT_BENEFITS).toContain("Season recap");
    expect(ENTITLEMENT_BENEFITS).toContain("Commissioner email tools");
  });

  it("Home and locked surfaces share the same entitlement CTA name", () => {
    expect(unlockCtaLabel()).toBe(unlockShortCta());
    expect(unlockCtaLabel("Unlock your doppelgänger")).toBe(
      "Unlock your doppelgänger — $2.99",
    );
  });
});
