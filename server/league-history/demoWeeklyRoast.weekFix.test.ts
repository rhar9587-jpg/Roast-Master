import { describe, expect, it } from "vitest";
import { getDemoWeeklyRoast } from "./demoLeague";
import { DEMO_ICONIC_WEEK } from "./demo/canonicalDemoFixture";

describe("demo weekly roast weeks", () => {
  it("iconic week returns a completed recap", async () => {
    const roast = await getDemoWeeklyRoast({ week: DEMO_ICONIC_WEEK });
    expect(roast.week).toBe(DEMO_ICONIC_WEEK);
    expect(roast.signals?.recapReady).toBe(true);
    expect(roast.signals?.slateStatus).toBe("final");
    expect(Array.isArray(roast.cards) && roast.cards.length).toBeGreaterThan(0);
  });

  it("Week 1 without fixture matchups returns unavailable slate (no throw)", async () => {
    const roast = await getDemoWeeklyRoast({ week: 1 });
    expect(roast.week).toBe(1);
    expect(roast.signals?.recapReady).toBe(false);
    expect(roast.signals?.slateStatus).toBe("unavailable");
    expect(roast.fallback_reason).toBe("demo_week_without_matchups");
    expect(String(roast.groupChatSummary)).toContain(`Week ${DEMO_ICONIC_WEEK}`);
  });
});
