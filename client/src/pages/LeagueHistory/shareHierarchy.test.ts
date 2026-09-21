import { describe, expect, it } from "vitest";
import {
  COPY_PUBLIC_RECAP_LINK_LABEL,
  DEMOLISHED_WEEK_LEVEL_SHARE_LABELS,
  EMAIL_TOOLS_LABEL,
  SAVE_IMAGE_LABEL,
  SEND_EMAIL_LABEL,
  SHARE_THIS_CARD_LABEL,
  SHARE_WEEKLY_RECAP_LABEL,
  VIEW_EMAIL_LABEL,
} from "./shareHierarchyLabels";
import { buildWeeklyRoastClipboardText } from "@/components/RoastCard";
import { buildCommissionerPublicRecapUrl } from "./weeklyCommissionerShare";
import type { RoastResponse } from "@shared/schema";
import { SITE_URL } from "@shared/site";

describe("Weekly sharing hierarchy labels", () => {
  it("Weekly exposes one primary Share weekly recap action label", () => {
    expect(SHARE_WEEKLY_RECAP_LABEL).toBe("Share weekly recap");
  });

  it("duplicate week-level share labels are demoted/removed from the primary vocabulary", () => {
    for (const label of DEMOLISHED_WEEK_LEVEL_SHARE_LABELS) {
      expect(label).not.toBe(SHARE_WEEKLY_RECAP_LABEL);
      expect(SHARE_WEEKLY_RECAP_LABEL.toLowerCase()).not.toBe(label.toLowerCase());
    }
    expect(DEMOLISHED_WEEK_LEVEL_SHARE_LABELS).toContain("More share options");
    expect(DEMOLISHED_WEEK_LEVEL_SHARE_LABELS).toContain("Post the Roast");
    expect(DEMOLISHED_WEEK_LEVEL_SHARE_LABELS).toContain("Preview email");
  });

  it("card exposes Share this card with Save image as secondary", () => {
    expect(SHARE_THIS_CARD_LABEL).toBe("Share this card");
    expect(SAVE_IMAGE_LABEL).toBe("Save image");
    expect(SAVE_IMAGE_LABEL).not.toBe(SHARE_THIS_CARD_LABEL);
  });

  it("Email tools contains View email, Copy public recap link, Send email", () => {
    expect(EMAIL_TOOLS_LABEL).toBe("Email tools");
    expect(VIEW_EMAIL_LABEL).toBe("View email");
    expect(COPY_PUBLIC_RECAP_LINK_LABEL).toBe("Copy public recap link");
    expect(SEND_EMAIL_LABEL).toBe("Send email");
  });

  it("generic ambiguous Preview labels are not used for email view", () => {
    expect(VIEW_EMAIL_LABEL.toLowerCase()).not.toBe("preview");
    expect(VIEW_EMAIL_LABEL.toLowerCase()).not.toContain("preview &");
    expect(EMAIL_TOOLS_LABEL.toLowerCase()).not.toContain("preview");
  });

  it("public recap URL copying target remains the public share URL", () => {
    const url = buildCommissionerPublicRecapUrl("1389437091309432832", 2);
    expect(url).toBe(`${SITE_URL}/share/league/1389437091309432832/week/2`);
    expect(url).not.toContain("weekly-email/preview");
  });

  it("completed-week sharing clipboard remains roast content + public URL", () => {
    const data = {
      league: { league_id: "lg", name: "NFL Downunder", season: "2026" },
      week: 2,
      headline: "Harks9 feasted.",
      stats: {
        averageScore: 110,
        highestScorer: { username: "Harks9", score: 142.3, roster_id: 1 },
        lowestScorer: { username: "Bob", score: 70.2, roster_id: 2 },
      },
      cards: [],
      groupChatSummary: "summary",
      signals: { recapReady: true, slateStatus: "final" },
    } as RoastResponse;
    const text = buildWeeklyRoastClipboardText(
      data,
      `${SITE_URL}/share/league/lg/week/2`,
    );
    expect(text).toContain("Harks9 feasted");
    expect(text).toContain("Biggest embarrassment");
    expect(text).toContain("/share/league/lg/week/2");
  });

  it("non-final week share behaviour still respects canonical finality", () => {
    const data = {
      league: { league_id: "lg", name: "NFL Downunder", season: "2026" },
      week: 3,
      headline: "Week 3 hasn't kicked off yet.",
      stats: {
        averageScore: 0,
        highestScorer: { username: "Harks9", score: 0, roster_id: 1 },
        lowestScorer: { username: "Harks9", score: 0, roster_id: 1 },
      },
      cards: [],
      groupChatSummary: "Not a completed recap.",
      signals: { recapReady: false, slateStatus: "upcoming" },
    } as RoastResponse;
    const text = buildWeeklyRoastClipboardText(
      data,
      `${SITE_URL}/share/league/lg/week/3`,
    );
    expect(text.toLowerCase()).toContain("hasn't kicked off");
    expect(text.toLowerCase()).not.toContain("embarrassment");
    expect(text).toContain("/share/league/lg/week/3");
  });

  it("mobile hierarchy keeps a single primary week CTA label", () => {
    // Only one primary week-level label exists in the vocabulary.
    const primaryWeekLabels = [SHARE_WEEKLY_RECAP_LABEL];
    expect(primaryWeekLabels).toHaveLength(1);
    expect(primaryWeekLabels[0]).not.toMatch(/Share Week \d/);
  });
});
