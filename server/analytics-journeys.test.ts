import { describe, expect, it } from "vitest";
import { recordEvent, getPurchaseJourneys, ensureDb } from "./analytics-db";

describe("getPurchaseJourneys", () => {
  it("reconstructs a checkout → webhook → post-purchase timeline by league", async () => {
    await ensureDb();
    const leagueId = `test-league-${Date.now()}`;
    const base = Date.now();

    await recordEvent("league_history_dominance", "/api/league-history/dominance", "GET", base - 60_000, {
      league_id: leagueId,
    });
    await recordEvent("unlock_clicked", "/api/track", "POST", base - 30_000, {
      league_id: leagueId,
      source: "league_history",
    });
    await recordEvent("checkout_session_created", "/api/checkout/create-session", "POST", base - 20_000, {
      league_id: leagueId,
      session_id: "cs_test_123",
    });
    await recordEvent("purchase_completed_webhook", "/api/stripe/webhook", "POST", base, {
      league_id: leagueId,
      session_id: "cs_test_123",
      amount_cents: 299,
      currency: "usd",
    });
    await recordEvent("purchase_success", "/api/track", "POST", base + 5_000, {
      league_id: leagueId,
    });
    await recordEvent("nfl_roast", "/api/roast", "POST", base + 15_000, {
      league_id: leagueId,
      week: 12,
    });

    const journeys = await getPurchaseJourneys(10);
    const mine = journeys.find((j) => j.league_id === leagueId);
    expect(mine).toBeTruthy();
    expect(mine!.confirmed_via_webhook).toBe(true);
    expect(mine!.client_success_seen).toBe(true);
    expect(mine!.amount_cents).toBe(299);
    expect(mine!.unlock_clicked_source).toBe("league_history");
    expect(mine!.steps.map((s) => s.type)).toEqual(
      expect.arrayContaining([
        "unlock_clicked",
        "checkout_session_created",
        "purchase_completed_webhook",
        "purchase_success",
        "nfl_roast",
      ]),
    );
    expect(mine!.post_purchase_actions).toContain("nfl_roast");
  });
});
