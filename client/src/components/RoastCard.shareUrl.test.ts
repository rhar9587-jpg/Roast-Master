import { describe, expect, it } from "vitest";
import { SITE_URL } from "@shared/site";
import { weeklyPublicShareUrl } from "@shared/weeklyShareUrl";
import { buildWeeklyPublicShareUrlFromRoast } from "@/components/RoastCard";
import type { RoastResponse } from "@shared/schema";

describe("Share Week uses public share URL", () => {
  it("builds the canonical /share/league/.../week/... URL from roast data", () => {
    const data = {
      league: { league_id: "demo-group-chat-dynasty", name: "Group Chat Dynasty", season: "2024" },
      week: 8,
      headline: "Week 8",
      stats: {
        averageScore: 100,
        highestScorer: { username: "A", score: 120, roster_id: 1 },
        lowestScorer: { username: "B", score: 70, roster_id: 2 },
      },
      cards: [],
      groupChatSummary: "summary",
    } as RoastResponse;

    const url = buildWeeklyPublicShareUrlFromRoast(data);
    expect(url).toBe(`${SITE_URL}/share/league/demo-group-chat-dynasty/week/8`);
    expect(url).toBe(weeklyPublicShareUrl("demo-group-chat-dynasty", 8));
    expect(url).not.toContain("/api/");
    expect(url).not.toContain("weekly-email/preview");
  });
});
