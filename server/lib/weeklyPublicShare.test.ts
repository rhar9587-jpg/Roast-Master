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
  buildWeeklyShareOgPngResponse,
  buildWeeklyShareOgSvg,
  buildWeeklySharePageHtml,
  getFallbackWeeklyShareOgPng,
  isPngBuffer,
  loadWeeklyPublicShare,
  readPngDimensions,
  renderWeeklyShareOgPng,
  renderWeeklyShareOgPngSafe,
  WEEKLY_SHARE_OG_HEIGHT,
  WEEKLY_SHARE_OG_WIDTH,
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
  recapReady: true,
  slateStatus: "final",
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
  it("share page includes absolute HTTPS og:image", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    const match = html.match(/property="og:image" content="([^"]+)"/);
    expect(match?.[1]).toMatch(/^https:\/\//);
    expect(match?.[1]).toBe(
      `${SITE_URL}/share/league/1389437091309432832/week/1/og.png`,
    );
  });

  it("og:image:type is image/png", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain('property="og:image:type" content="image/png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('property="og:image:secure_url"');
  });

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
    // Metadata is in initial HTML — no client bundle required for crawlers
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

  it("public share page does not render completed recap language for non-final week", () => {
    const html = buildWeeklySharePageHtml(
      {
        ...sample,
        week: 3,
        weekIsFinal: true,
        recapReady: false,
        slateStatus: "unavailable",
        headline: "Week 3 scores aren't in yet.",
        summary: "NFL Downunder — Week 3 doesn't have final scored matchups yet.",
        heroFact: "Week 3 scores unavailable",
        beats: [{ title: "Scores unavailable", subtitle: "Not a completed recap." }],
      },
      SITE_URL,
    );
    expect(html.toLowerCase()).not.toContain("ran the slate");
    expect(html).toContain("Scores unavailable");
    expect(html).not.toContain("League receipt");
  });
});

describe("OG image endpoint payload", () => {
  it("OG image endpoint returns PNG bytes with valid signature and 1200x630", async () => {
    const { png, usedFallback } = await buildWeeklyShareOgPngResponse(
      DEMO_LEAGUE_ID,
      DEMO_ICONIC_WEEK,
    );
    expect(usedFallback).toBe(false);
    expect(isPngBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).toString("binary")).toBe("\x89PNG\r\n\x1a\n");
    const dims = readPngDimensions(png);
    expect(dims).toEqual({
      width: WEEKLY_SHARE_OG_WIDTH,
      height: WEEKLY_SHARE_OG_HEIGHT,
    });
    // Must not be HTML/text
    expect(png.toString("utf8", 0, 64).toLowerCase()).not.toContain("<!doctype");
    expect(png.toString("utf8", 0, 64).toLowerCase()).not.toContain("<html");
  });

  it("forced image-generation failure returns fallback PNG", () => {
    const { png, usedFallback } = renderWeeklyShareOgPngSafe(sample, {
      forceFallback: true,
    });
    expect(usedFallback).toBe(true);
    expect(isPngBuffer(png)).toBe(true);
    expect(readPngDimensions(png)).toEqual({
      width: WEEKLY_SHARE_OG_WIDTH,
      height: WEEKLY_SHARE_OG_HEIGHT,
    });
    expect(png.equals(getFallbackWeeklyShareOgPng())).toBe(true);
  });

  it("data-load failure still returns fallback PNG (never text/HTML)", async () => {
    const { png, usedFallback } = await buildWeeklyShareOgPngResponse(
      DEMO_LEAGUE_ID,
      0, // invalid week → load throws → fallback
    );
    expect(usedFallback).toBe(true);
    expect(isPngBuffer(png)).toBe(true);
    expect(readPngDimensions(png).width).toBe(1200);
    expect(png.toString("utf8", 0, 32)).not.toMatch(/OG image unavailable/i);
  });

  it("/share/.../og.png path is distinct from HTML share page path", () => {
    const page = weeklyPublicSharePath(DEMO_LEAGUE_ID, 8);
    const image = weeklyPublicShareOgImageUrl(DEMO_LEAGUE_ID, 8).replace(SITE_URL, "");
    expect(image).toBe(`${page}/og.png`);
    expect(image.startsWith("/share/")).toBe(true);
    expect(image.endsWith("/og.png")).toBe(true);
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
    expect(html).toContain('property="og:image:type" content="image/png"');
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
    expect(isPngBuffer(png)).toBe(true);
    expect(readPngDimensions(png)).toEqual({ width: 1200, height: 630 });
  });
});
