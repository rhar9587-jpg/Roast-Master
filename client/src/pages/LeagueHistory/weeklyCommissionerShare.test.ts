import { describe, expect, it } from "vitest";
import { SITE_URL } from "@shared/site";
import { weeklyPublicShareUrl } from "@shared/weeklyShareUrl";
import {
  buildCommissionerEmailPreviewPath,
  buildCommissionerPublicRecapUrl,
  isCommissionerEmailPreviewApiUrl,
} from "./weeklyCommissionerShare";

describe("commissioner preview vs public share URLs", () => {
  it("Preview still opens /api/leagues/:leagueId/weekly-email/preview?...", () => {
    const path = buildCommissionerEmailPreviewPath({
      leagueId: "1389437091309432832",
      week: 1,
      mode: "recap",
      note: "Big week!",
      signoff: "Good luck",
    });
    expect(path.startsWith("/api/leagues/1389437091309432832/weekly-email/preview?")).toBe(
      true,
    );
    expect(path).toContain("week=1");
    expect(path).toContain("mode=recap");
    expect(path).toContain("note=Big+week%21");
    expect(path).toContain("signoff=Good+luck");
    expect(isCommissionerEmailPreviewApiUrl(path)).toBe(true);
  });

  it("Copy recap link returns /share/league/:leagueId/week/:week", () => {
    const url = buildCommissionerPublicRecapUrl("1389437091309432832", 1);
    expect(url).toBe(`${SITE_URL}/share/league/1389437091309432832/week/1`);
    expect(url).toBe(weeklyPublicShareUrl("1389437091309432832", 1));
    expect(isCommissionerEmailPreviewApiUrl(url)).toBe(false);
    expect(url).not.toContain("/api/");
    expect(url).not.toContain("weekly-email/preview");
  });

  it("public share URL contains no commissioner note/signoff/email", () => {
    const url = buildCommissionerPublicRecapUrl("demo-group-chat-dynasty", 8);
    expect(url.toLowerCase()).not.toContain("note=");
    expect(url.toLowerCase()).not.toContain("signoff=");
    expect(url.toLowerCase()).not.toContain("email");
    expect(url.toLowerCase()).not.toContain("commissioner");
    expect(url).not.toContain("?");
  });

  it("no commissioner sharing action exposes the API preview URL", () => {
    const shareUrl = buildCommissionerPublicRecapUrl("abc", 3);
    const previewPath = buildCommissionerEmailPreviewPath({
      leagueId: "abc",
      week: 3,
      mode: "recap",
      note: "secret note",
    });
    // Sharing uses public URL; preview is a separate internal action.
    expect(shareUrl).not.toContain("weekly-email/preview");
    expect(isCommissionerEmailPreviewApiUrl(shareUrl)).toBe(false);
    expect(isCommissionerEmailPreviewApiUrl(previewPath)).toBe(true);
    expect(previewPath).toContain("note=secret+note");
    expect(shareUrl).not.toContain("secret");
  });
});
