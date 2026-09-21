import { describe, expect, it } from "vitest";
import type { RoastResponse } from "@shared/schema";
import { SITE_URL } from "@shared/site";
import { buildWeeklyRoastClipboardText } from "@/components/RoastCard";

function roast(partial: Partial<RoastResponse> & { signals?: Record<string, unknown> }): RoastResponse {
  return {
    league: { league_id: "1389437091309432832", name: "NFL Downunder", season: "2026" },
    week: 3,
    headline: "Week 3 hasn't kicked off yet.",
    stats: {
      averageScore: 0,
      highestScorer: { username: "Harks9", score: 0, roster_id: 1 },
      lowestScorer: { username: "Harks9", score: 0, roster_id: 1 },
    },
    cards: [],
    groupChatSummary: "Not a completed recap.",
    ...partial,
  } as RoastResponse;
}

describe("Share Week clipboard respects slate finality", () => {
  const shareUrl = `${SITE_URL}/share/league/1389437091309432832/week/3`;

  it("upcoming text has no zero-score embarrassment", () => {
    const text = buildWeeklyRoastClipboardText(
      roast({
        signals: { recapReady: false, slateStatus: "upcoming" },
      }),
      shareUrl,
    );
    expect(text.toLowerCase()).toContain("hasn't kicked off");
    expect(text.toLowerCase()).not.toContain("embarrassment");
    expect(text).not.toContain("0.0");
    expect(text).not.toContain("Top Dog");
    expect(text).toContain(shareUrl);
  });

  it("live text has no completed superlatives", () => {
    const text = buildWeeklyRoastClipboardText(
      roast({
        headline: "Week 3 is live.",
        signals: { recapReady: false, slateStatus: "live" },
        stats: {
          averageScore: 40,
          highestScorer: { username: "Harks9", score: 48.5, roster_id: 1 },
          lowestScorer: { username: "Bob", score: 32, roster_id: 2 },
        },
      }),
      shareUrl,
    );
    expect(text.toLowerCase()).toContain("live");
    expect(text.toLowerCase()).not.toContain("embarrassment");
    expect(text).not.toContain("🔥 Fantasy Roast");
  });

  it("final week sharing remains unchanged with embarrassment line", () => {
    const text = buildWeeklyRoastClipboardText(
      roast({
        week: 2,
        headline: "Harks9 feasted.",
        signals: { recapReady: true, slateStatus: "final" },
        stats: {
          averageScore: 110,
          highestScorer: { username: "Harks9", score: 142.3, roster_id: 1 },
          lowestScorer: { username: "Bob", score: 70.2, roster_id: 2 },
        },
      }),
      `${SITE_URL}/share/league/1389437091309432832/week/2`,
    );
    expect(text).toContain("🔥 Fantasy Roast");
    expect(text).toContain("Biggest embarrassment");
    expect(text).toContain("Bob");
    expect(text).toContain("70.2");
  });
});
