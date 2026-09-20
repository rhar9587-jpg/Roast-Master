import { describe, expect, it } from "vitest";
import { DEMO_ICONIC_WEEK, DEMO_LEAGUE_ID, DEMO_LEAGUE_NAME } from "../league-history/demo/canonicalDemoFixture";
import { SITE_URL } from "@shared/site";
import {
  weeklyPublicShareOgImageUrl,
  weeklyPublicSharePath,
  weeklyPublicShareUrl,
} from "@shared/weeklyShareUrl";
import {
  buildShareOgDescription,
  buildShareOgTitle,
  buildWeeklyShareErrorHtml,
  buildWeeklyShareOgSvg,
  buildWeeklySharePageHtml,
  loadWeeklyPublicShare,
  renderWeeklyShareOgPng,
  WeeklyPublicShareError,
  type WeeklyPublicShareData,
} from "./weeklyPublicShare";

const sample: WeeklyPublicShareData = {
  leagueId: "1389437091309432832",
  leagueName: "NFL Downunder",
  week: 1,
  mode: "recap",
  headline: "Week 1 was chaos.",
  summary: "Top Dog ate, fraud watch is open, and someone got smoked.",
  heroFact: "Top scorer: Alice — 142.3 pts",
  weekIsFinal: true,
  isDemo: false,
  beats: [
    { title: "Top Dog", subtitle: "Alice paced the league.", stat: "142.3 pts" },
    { title: "Biggest Embarrassment", subtitle: "Alice dropped Bob by 40.0." },
  ],
};

describe("weeklyPublicShareUrl helpers", () => {
  it("builds the preferred public share path", () => {
    expect(weeklyPublicSharePath("1389437091309432832", 1)).toBe(
      "/share/league/1389437091309432832/week/1",
    );
  });

  it("builds absolute canonical share + og image URLs", () => {
    expect(weeklyPublicShareUrl("abc", 8)).toBe(`${SITE_URL}/share/league/abc/week/8`);
    expect(weeklyPublicShareOgImageUrl("abc", 8)).toBe(
      `${SITE_URL}/share/league/abc/week/8/og.png`,
    );
  });
});

describe("weekly share SSR HTML + OG metadata", () => {
  it("valid weekly share HTML includes required OG/Twitter tags without client JS", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('property="og:title"');
    expect(html).toContain("NFL Downunder");
    expect(html).toContain("Week 1");
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
    // No client bundle required for crawlers
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it("og:title contains league name + week", () => {
    const title = buildShareOgTitle(sample);
    expect(title).toContain("NFL Downunder");
    expect(title).toContain("Week 1");
    expect(title).toContain("Fantasy Roast");
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain(`content="${title}"`);
  });

  it("og:description exists", () => {
    const description = buildShareOgDescription(sample);
    expect(description.length).toBeGreaterThan(20);
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain('property="og:description"');
    expect(html).toContain(description.slice(0, 24));
  });

  it("og:image is an absolute HTTPS URL", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    const match = html.match(/property="og:image" content="([^"]+)"/);
    expect(match?.[1]).toMatch(/^https:\/\//);
    expect(match?.[1]).toBe(
      `${SITE_URL}/share/league/1389437091309432832/week/1/og.png`,
    );
  });

  it("og:url is the canonical public share URL", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    const match = html.match(/property="og:url" content="([^"]+)"/);
    expect(match?.[1]).toBe(`${SITE_URL}/share/league/1389437091309432832/week/1`);
  });

  it("does not expose email / payment / internal private fields", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    const lower = html.toLowerCase();
    expect(lower).not.toContain("commissioner_email");
    expect(lower).not.toContain("stripe");
    expect(lower).not.toContain("payment");
    expect(lower).not.toContain("@gmail.com");
    expect(lower).not.toContain("signoff");
    expect(lower).not.toContain("admin_key");
    expect(lower).not.toContain("weekly-email/preview");
  });

  it("invalid week returns a clean branded error page", () => {
    const html = buildWeeklyShareErrorHtml("Week must be a whole number from 1 to 18.", SITE_URL, 400);
    expect(html).toContain("Fantasy Roast");
    expect(html).toContain("Invalid share link");
    expect(html).not.toContain("at Object.");
    expect(html).not.toContain("stack");
  });
});

describe("weekly share data loading (demo)", () => {
  it("demo route data loads and renders HTML", async () => {
    const data = await loadWeeklyPublicShare(DEMO_LEAGUE_ID, DEMO_ICONIC_WEEK);
    expect(data.leagueName).toBe(DEMO_LEAGUE_NAME);
    expect(data.week).toBe(DEMO_ICONIC_WEEK);
    expect(data.isDemo).toBe(true);
    const html = buildWeeklySharePageHtml(data, SITE_URL);
    expect(html).toContain(DEMO_LEAGUE_NAME);
    expect(html).toContain(`Week ${DEMO_ICONIC_WEEK}`);
    expect(html).toContain("og:image");
  });

  it("rejects invalid week with WeeklyPublicShareError", async () => {
    await expect(loadWeeklyPublicShare(DEMO_LEAGUE_ID, 0)).rejects.toBeInstanceOf(
      WeeklyPublicShareError,
    );
    await expect(loadWeeklyPublicShare(DEMO_LEAGUE_ID, 99)).rejects.toMatchObject({
      code: "invalid_week",
      status: 400,
    });
  });

  it("renders a real PNG OG image for demo data", async () => {
    const data = await loadWeeklyPublicShare(DEMO_LEAGUE_ID, DEMO_ICONIC_WEEK);
    const svg = buildWeeklyShareOgSvg(data);
    expect(svg).toContain("1200");
    expect(svg).toContain("630");
    expect(svg).toContain(DEMO_LEAGUE_NAME);
    const png = renderWeeklyShareOgPng(data);
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).toString("binary")).toBe("\x89PNG\r\n\x1a\n");
    expect(png.length).toBeGreaterThan(1000);
  });
});
