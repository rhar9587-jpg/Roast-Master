import { describe, expect, it } from "vitest";
import { DEMO_ICONIC_WEEK, DEMO_LEAGUE_ID, DEMO_LEAGUE_NAME } from "../league-history/demo/canonicalDemoFixture";
import { SITE_URL } from "@shared/site";
import {
  roastMyLeagueUrl,
  weeklyLeagueAppPath,
  weeklyLeagueAppUrl,
  weeklyPublicShareOgImageUrl,
  weeklyPublicSharePath,
  weeklyPublicShareUrl,
} from "@shared/weeklyShareUrl";
import { getDemoWeeklyEmailPayload, getDemoPowerRankingInputs } from "../league-history/demoLeague";
import { generatePowerRankings } from "./powerRankings";
import {
  buildDemoPublicPowerRankings,
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
  toPublicShareRankings,
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
  heroFact: "Murder Scene — +40.0 pts — Alice dropped Bob by 40.0.",
  hero: {
    type: "biggest_embarrassment",
    title: "Murder Scene",
    subtitle: "Alice dropped Bob by 40.0.",
    stat: "+40.0 pts",
  },
  weekIsFinal: true,
  recapReady: true,
  slateStatus: "final",
  isDemo: false,
  matchups: [
    {
      winnerName: "Alice",
      winnerScore: 142.3,
      loserName: "Bob",
      loserScore: 102.3,
      margin: 40,
    },
    {
      winnerName: "Carol",
      winnerScore: 118.1,
      loserName: "Dave",
      loserScore: 110.4,
      margin: 7.7,
    },
  ],
  powerRankings: [
    { rank: 1, teamName: "Alice", record: "1-0", showMovement: false },
    { rank: 2, teamName: "Carol", record: "1-0", showMovement: false },
    { rank: 3, teamName: "Dave", record: "0-1", showMovement: false },
    { rank: 4, teamName: "Bob", record: "0-1", showMovement: false },
  ],
  beats: [
    { title: "Top Dog", subtitle: "Alice paced the league.", stat: "142.3 pts", type: "top_dog" },
    { title: "Fraud Watch", subtitle: "Dave won light.", type: "fraud_watch" },
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

  it("Roast my league routes to username-entry / get-started", () => {
    expect(roastMyLeagueUrl(SITE_URL)).toBe(`${SITE_URL}/#get-started`);
  });

  it("View full Week X recap deep-links to Weekly with league + week", () => {
    const path = weeklyLeagueAppPath("1389437091309432832", { week: 1 });
    expect(path).toContain("league_id=1389437091309432832");
    expect(path).toContain("tab=weekly");
    expect(path).toContain("week=1");
    expect(path).not.toContain("tab=history");
    expect(path).not.toContain("receipt");
    const url = weeklyLeagueAppUrl("1389437091309432832", SITE_URL, { week: 8 });
    expect(url).toContain(`${SITE_URL}/league-history/dominance?`);
    expect(url).toContain("week=8");
    expect(url).toContain("tab=weekly");
  });
});

describe("weekly share SSR HTML + OG metadata", () => {
  it("final public page leads with a roast hero", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain('class="hero roast-hero"');
    expect(html).toContain('data-hero-type="biggest_embarrassment"');
    expect(html).toContain("Murder Scene");
    expect(html).toContain("+40.0 pts");
    expect(html).toContain("Alice dropped Bob by 40.0.");
    // Hero appears before matchups / rankings / CTA
    const heroIdx = html.indexOf("roast-hero");
    const matchupsIdx = html.indexOf("Week 1 results");
    const ranksIdx = html.indexOf("Power Rankings");
    const ctaIdx = html.indexOf("Roast my league");
    expect(heroIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeLessThan(matchupsIdx);
    expect(matchupsIdx).toBeLessThan(ranksIdx);
    expect(ranksIdx).toBeLessThan(ctaIdx);
  });

  it("completed matchup results are shown for final weeks", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain("Week 1 results");
    expect(html).toContain("Alice");
    expect(html).toContain("142.3–102.3");
    expect(html).toContain("Bob");
    expect(html).not.toContain("0.0–0.0");
  });

  it("Power Rankings render from shared ranking payload", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain("Power Rankings");
    expect(html).toContain("Alice");
    expect(html).toContain("1-0");
    expect(html).not.toContain('class="rank-move');
  });

  it("movement indicators only render when valid historical comparison exists", () => {
    const withMove: WeeklyPublicShareData = {
      ...sample,
      powerRankings: [
        {
          rank: 1,
          teamName: "Alice",
          record: "2-0",
          showMovement: true,
          trend: "up",
          placesMoved: 2,
          movementLabel: "↑ 2",
        },
        {
          rank: 2,
          teamName: "Bob",
          record: "0-2",
          showMovement: true,
          trend: "down",
          placesMoved: 2,
          movementLabel: "↓ 2",
        },
        {
          rank: 3,
          teamName: "Carol",
          record: "1-1",
          showMovement: true,
          trend: "flat",
          placesMoved: 0,
          movementLabel: "Same",
        },
      ],
    };
    const html = buildWeeklySharePageHtml(withMove, SITE_URL);
    expect(html).toContain('class="rank-move up"');
    expect(html).toContain("↑ 2");
    expect(html).toContain('class="rank-move down"');
    expect(html).toContain("↓ 2");
    expect(html).toContain('class="rank-move flat"');
    expect(html).toContain("Same");

    const noHistory = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(noHistory).not.toContain('class="rank-move');
  });

  it("Power Rankings omission fails gracefully if ranking data is unavailable", () => {
    const html = buildWeeklySharePageHtml(
      { ...sample, powerRankings: null },
      SITE_URL,
    );
    expect(html).toContain("Murder Scene");
    expect(html).toContain("Week 1 results");
    expect(html).not.toContain("Power Rankings");
    expect(html).toContain("Roast my league");
  });

  it("only 2–3 supporting roast moments render", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain("Also this week");
    const beatCount = (html.match(/class="beat"/g) || []).length;
    expect(beatCount).toBeGreaterThanOrEqual(2);
    expect(beatCount).toBeLessThanOrEqual(3);
  });

  it("CTA: Roast my league + View full Week X recap", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain(`href="${SITE_URL}/#get-started"`);
    expect(html).toContain(">Roast my league<");
    expect(html).toContain("View full Week 1 recap");
    expect(html).toContain("tab=weekly");
    expect(html).toContain("week=1");
    expect(html).toContain("league_id=1389437091309432832");
  });

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
    expect(description.toLowerCase()).toContain("murder scene");
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
    expect(lower).not.toContain("commissionernote");
    expect(lower).not.toContain("stripe");
    expect(lower).not.toContain("payment");
    expect(lower).not.toContain("@gmail.com");
    expect(lower).not.toContain("signoff");
    expect(lower).not.toContain("admin_key");
    expect(lower).not.toContain("weekly-email/preview");
    expect(lower).not.toContain("unlock");
  });

  it("invalid week returns a clean branded error page", () => {
    const html = buildWeeklyShareErrorHtml("Week must be a whole number from 1 to 18.", SITE_URL, 400);
    expect(html).toContain("Fantasy Roast");
    expect(html).toContain("Invalid share link");
    expect(html).toContain("Roast my league");
    expect(html).not.toContain("at Object.");
    expect(html).not.toContain("stack");
  });

  it("public page H1 says Upcoming for upcoming week", () => {
    const html = buildWeeklySharePageHtml(
      {
        ...sample,
        week: 3,
        weekIsFinal: false,
        recapReady: false,
        slateStatus: "upcoming",
        headline: "Week 3 hasn't kicked off yet.",
        summary: "Matchups are set.",
        heroFact: "Week 3 Upcoming",
        hero: null,
        matchups: [],
        powerRankings: null,
        beats: [],
      },
      SITE_URL,
    );
    expect(html).toContain("<h1>Week 3 Upcoming</h1>");
    expect(html).not.toContain("<h1>Week 3 Recap</h1>");
  });

  it("public page H1 says Live for live week", () => {
    const html = buildWeeklySharePageHtml(
      {
        ...sample,
        week: 3,
        weekIsFinal: false,
        recapReady: false,
        slateStatus: "live",
        headline: "Week 3 is live.",
        summary: "Scores moving.",
        heroFact: "Week 3 is live",
        hero: null,
        matchups: [],
        powerRankings: null,
        beats: [],
      },
      SITE_URL,
    );
    expect(html).toContain("<h1>Week 3 Live</h1>");
  });

  it("public page says Recap only for final week", () => {
    const html = buildWeeklySharePageHtml(sample, SITE_URL);
    expect(html).toContain("<h1>Week 1 Recap</h1>");
  });

  it("OG title/description match slate state", () => {
    const upcoming = {
      ...sample,
      week: 3,
      recapReady: false,
      slateStatus: "upcoming" as const,
      summary: "Week 3 hasn't kicked off yet.",
      heroFact: "Week 3 Upcoming",
      hero: null,
    };
    const title = buildShareOgTitle(upcoming);
    const description = buildShareOgDescription(upcoming);
    expect(title).toContain("Week 3 Upcoming");
    expect(title.toLowerCase()).not.toContain("recap");
    expect(description.toLowerCase()).not.toContain("recap: top scorer");
    expect(description.toLowerCase()).toMatch(/hasn't kicked off|upcoming/);

    const finalTitle = buildShareOgTitle(sample);
    expect(finalTitle).toContain("Week 1 Recap");
  });

  it("no fake results / winner claims for upcoming/live/unavailable weeks", () => {
    for (const slateStatus of ["upcoming", "live", "unavailable"] as const) {
      const html = buildWeeklySharePageHtml(
        {
          ...sample,
          week: 3,
          weekIsFinal: slateStatus === "unavailable",
          recapReady: false,
          slateStatus,
          headline: `Week 3 ${slateStatus}`,
          summary: "Not final.",
          heroFact: `Week 3 ${slateStatus}`,
          hero: {
            type: "biggest_embarrassment",
            title: "Murder Scene",
            subtitle: "Should not render",
            stat: "+99",
          },
          matchups: [
            {
              winnerName: "Fake",
              winnerScore: 0,
              loserName: "Shell",
              loserScore: 0,
              margin: 0,
            },
          ],
          powerRankings: [
            { rank: 1, teamName: "Fake", record: "0-0", showMovement: true, trend: "up" },
          ],
          beats: [{ title: "Top Dog", subtitle: "Should not render", type: "top_dog" }],
        },
        SITE_URL,
      );
      expect(html).not.toContain("roast-hero");
      expect(html).not.toContain("Murder Scene");
      expect(html).not.toContain("Week 3 results");
      expect(html).not.toContain("0.0–0.0");
      expect(html).not.toContain("Power Rankings");
      expect(html).not.toContain("Also this week");
      expect(html).not.toContain('class="rank-move');
      expect(html).toContain("Roast my league");
    }
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
        hero: null,
        matchups: [],
        powerRankings: null,
        beats: [],
      },
      SITE_URL,
    );
    expect(html.toLowerCase()).not.toContain("ran the slate");
    expect(html).toContain("Scores unavailable");
    expect(html).not.toContain("League receipt");
    expect(html).not.toContain("Roast of the week");
  });
});

describe("Power Rankings consistency across surfaces", () => {
  it("public recap ranking order matches commissioner email ranking order", async () => {
    const week = DEMO_ICONIC_WEEK;
    const email = await getDemoWeeklyEmailPayload(week);
    const publicRanks = buildDemoPublicPowerRankings(week);
    expect(publicRanks).not.toBeNull();
    expect(publicRanks!.length).toBe(email.rankings.length);
    expect(publicRanks!.map((r) => r.teamName)).toEqual(email.rankings.map((r) => r.teamName));
    expect(publicRanks!.map((r) => r.rank)).toEqual(email.rankings.map((r) => r.rank));

    // Same underlying generatePowerRankings(teams) source as Weekly rankings surface
    const { teams } = getDemoPowerRankingInputs(
      (await import("../league-history/demo/canonicalDemoFixture")).DEMO_ICONIC_SEASON,
      week,
    );
    const engine = generatePowerRankings(teams, []);
    expect(publicRanks!.map((r) => r.teamName)).toEqual(engine.map((r) => r.teamName));

    const data = await loadWeeklyPublicShare(DEMO_LEAGUE_ID, week);
    expect(data.powerRankings?.map((r) => r.teamName)).toEqual(
      email.rankings.map((r) => r.teamName),
    );
  });

  it("toPublicShareRankings omits movement without prior history", () => {
    const rows = toPublicShareRankings(
      [
        {
          rank: 1,
          teamId: "1",
          teamName: "A",
          record: "1-0",
          powerScore: 80,
          trend: "up",
          previousRank: 3,
          placesMoved: 2,
          showMovement: true,
          commentary: "x",
          wins: 1,
          losses: 0,
          ties: 0,
          pointsFor: 100,
          winPct: 1,
          averagePoints: 100,
          recentFormAverage: 100,
          expectedWins: 1,
          luckDelta: 0,
        },
      ],
      { hasPriorWeekHistory: false },
    );
    expect(rows[0]!.showMovement).toBe(false);
    expect(rows[0]!.trend).toBeUndefined();
    expect(rows[0]!.movementLabel).toBe("");
  });

  it("toPublicShareRankings preserves shared place deltas when prior exists", () => {
    const rows = toPublicShareRankings(
      [
        {
          rank: 3,
          teamId: "1",
          teamName: "A",
          record: "1-1",
          powerScore: 70,
          trend: "up",
          previousRank: 5,
          placesMoved: 2,
          showMovement: true,
          commentary: "x",
          wins: 1,
          losses: 1,
          ties: 0,
          pointsFor: 200,
          winPct: 0.5,
          averagePoints: 100,
          recentFormAverage: 100,
          expectedWins: 1,
          luckDelta: 0,
        },
        {
          rank: 6,
          teamId: "2",
          teamName: "B",
          record: "0-2",
          powerScore: 40,
          trend: "down",
          previousRank: 4,
          placesMoved: 2,
          showMovement: true,
          commentary: "x",
          wins: 0,
          losses: 2,
          ties: 0,
          pointsFor: 150,
          winPct: 0,
          averagePoints: 75,
          recentFormAverage: 75,
          expectedWins: 0.5,
          luckDelta: -0.5,
        },
        {
          rank: 2,
          teamId: "3",
          teamName: "C",
          record: "2-0",
          powerScore: 85,
          trend: "flat",
          previousRank: 2,
          placesMoved: 0,
          showMovement: true,
          commentary: "x",
          wins: 2,
          losses: 0,
          ties: 0,
          pointsFor: 220,
          winPct: 1,
          averagePoints: 110,
          recentFormAverage: 110,
          expectedWins: 1.5,
          luckDelta: 0.5,
        },
      ],
      { hasPriorWeekHistory: true },
    );
    expect(rows[0]).toMatchObject({
      showMovement: true,
      placesMoved: 2,
      movementLabel: "↑ 2",
    });
    expect(rows[1]).toMatchObject({
      showMovement: true,
      placesMoved: 2,
      movementLabel: "↓ 2",
    });
    expect(rows[2]).toMatchObject({
      showMovement: true,
      placesMoved: 0,
      movementLabel: "Same",
    });
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
  it("Week 1 completed public page remains valid with hero + matchups + rankings", () => {
    // Week 1 shape via presentation fixture (demo fixture centers iconic Week 8 scores).
    const week1 = { ...sample, week: 1 };
    expect(week1.recapReady).toBe(true);
    expect(week1.slateStatus).toBe("final");
    expect(week1.hero).not.toBeNull();
    expect(week1.matchups.length).toBeGreaterThan(0);
    expect(week1.powerRankings?.length).toBeGreaterThan(0);
    expect(week1.beats.length).toBeLessThanOrEqual(3);
    const html = buildWeeklySharePageHtml(week1, SITE_URL);
    expect(html).toContain("<h1>Week 1 Recap</h1>");
    expect(html).toContain("roast-hero");
    expect(html).toContain("Week 1 results");
    expect(html).toContain("Power Rankings");
    expect(html).toContain("Roast my league");
    expect(html).toContain("View full Week 1 recap");
    expect(html).toContain('property="og:image"');
  });

  it("demo iconic week loads and renders HTML with hero-first structure", async () => {
    const data = await loadWeeklyPublicShare(DEMO_LEAGUE_ID, DEMO_ICONIC_WEEK);
    expect(data.leagueName).toBe(DEMO_LEAGUE_NAME);
    expect(data.week).toBe(DEMO_ICONIC_WEEK);
    expect(data.isDemo).toBe(true);
    expect(data.hero).not.toBeNull();
    expect(data.matchups.every((m) => !(m.winnerScore === 0 && m.loserScore === 0))).toBe(true);
    const html = buildWeeklySharePageHtml(data, SITE_URL);
    expect(html).toContain(DEMO_LEAGUE_NAME);
    expect(html).toContain(`Week ${DEMO_ICONIC_WEEK}`);
    expect(html).toContain("og:image");
    expect(html).toContain('property="og:image:type" content="image/png"');
    expect(html.indexOf("roast-hero")).toBeLessThan(html.indexOf("Power Rankings"));
  });

  it("Week 3 upcoming public page remains non-final when forced upcoming state", () => {
    const html = buildWeeklySharePageHtml(
      {
        ...sample,
        week: 3,
        weekIsFinal: false,
        recapReady: false,
        slateStatus: "upcoming",
        hero: null,
        matchups: [],
        powerRankings: null,
        beats: [],
        heroFact: "Week 3 Upcoming",
        summary: "Week 3 hasn't kicked off yet.",
      },
      SITE_URL,
    );
    expect(html).toContain("<h1>Week 3 Upcoming</h1>");
    expect(html).not.toContain("roast-hero");
    expect(html).not.toContain("Week 3 results");
    expect(html).not.toContain("Power Rankings");
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
