import { describe, expect, it } from "vitest";
import { generateWeeklyEmail, generateWeeklyEmailPlainText, type WeeklyEmailData } from "./weeklyEmail";
import {
  buildIntroSummary,
  gateWeeklyEmailPayloadForSlate,
} from "./weeklyCommissioner";
import type { PowerRankingRow } from "./powerRankings";

const rankings = [
  {
    teamId: "1",
    teamName: "Harks9",
    rank: 1,
    previousRank: 1,
    powerScore: 90,
    expectedWins: 3,
    luckDelta: 0,
    commentary: "Solid.",
  },
] as PowerRankingRow[];

const zeroMatchups = [
  { teamA: "Harks9", scoreA: 0, teamB: "Bob", scoreB: 0 },
  { teamA: "C", scoreA: 0, teamB: "D", scoreB: 0 },
];

const basePayload: WeeklyEmailData = {
  leagueName: "NFL Downunder",
  week: 3,
  rankings: [
    {
      rank: 1,
      teamName: "Harks9",
      record: "2-0",
      powerScore: 90,
      trend: "flat",
      commentary: "Solid.",
    },
  ],
  introSummary: "placeholder",
  weekMatchups: zeroMatchups,
  weeklySuperlatives: {
    highScore: { teamName: "Harks9", points: 0 },
    lowScore: { teamName: "Harks9", points: 0 },
  },
  roastCallouts: [{ label: "Blowout", title: "X", line: "fake" }],
  villainOfTheWeek: { teamName: "Harks9", reason: "won big" },
};

describe("commissioner email slate gating", () => {
  it("upcoming week email does not say underway", () => {
    const intro = buildIntroSummary(3, rankings, {
      slateStatus: "upcoming",
      recapReady: false,
    });
    expect(intro.toLowerCase()).not.toContain("underway");
    expect(intro.toLowerCase()).toContain("hasn't kicked off");
  });

  it("upcoming week email does not render 0–0 results", () => {
    const intro = buildIntroSummary(3, rankings, {
      slateStatus: "upcoming",
      recapReady: false,
    });
    const payload = gateWeeklyEmailPayloadForSlate(
      { ...basePayload, introSummary: intro },
      { recapReady: false, slateStatus: "upcoming" },
    );
    const html = generateWeeklyEmail(payload);
    const text = generateWeeklyEmailPlainText(payload);
    expect(html).not.toContain("This week's results");
    expect(html).not.toMatch(/>0\.0</);
    expect(html).not.toContain("Harks9 — 0.0");
    expect(text).not.toContain("RESULTS");
    expect(payload.weekMatchups).toBeUndefined();
  });

  it("upcoming week email has no high/low score awards", () => {
    const payload = gateWeeklyEmailPayloadForSlate(basePayload, {
      recapReady: false,
      slateStatus: "upcoming",
    });
    const html = generateWeeklyEmail({
      ...payload,
      introSummary: buildIntroSummary(3, rankings, {
        slateStatus: "upcoming",
        recapReady: false,
      }),
    });
    expect(html).not.toContain("High score:");
    expect(html).not.toContain("Low score:");
    expect(html).not.toContain("Weekly Superlatives");
    expect(payload.weeklySuperlatives).toBeUndefined();
  });

  it("live week email avoids final-result language", () => {
    const intro = buildIntroSummary(3, rankings, {
      slateStatus: "live",
      recapReady: false,
    });
    const payload = gateWeeklyEmailPayloadForSlate(
      { ...basePayload, introSummary: intro },
      { recapReady: false, slateStatus: "live" },
    );
    const html = generateWeeklyEmail(payload);
    expect(intro.toLowerCase()).toContain("live");
    expect(intro.toLowerCase()).not.toContain("in the books");
    expect(html).not.toContain("This week's results");
    expect(html).not.toContain("Weekly Superlatives");
  });

  it("unavailable week email avoids final-result language", () => {
    const intro = buildIntroSummary(3, rankings, {
      slateStatus: "unavailable",
      recapReady: false,
    });
    const payload = gateWeeklyEmailPayloadForSlate(
      { ...basePayload, introSummary: intro },
      { recapReady: false, slateStatus: "unavailable" },
    );
    const html = generateWeeklyEmail(payload);
    expect(intro.toLowerCase()).toMatch(/aren't available|unavailable/);
    expect(html).not.toContain("This week's results");
    expect(html).not.toContain("High score:");
  });

  it("final week email still includes results and superlatives", () => {
    const intro = buildIntroSummary(2, rankings, {
      slateStatus: "final",
      recapReady: true,
    });
    const payload = gateWeeklyEmailPayloadForSlate(
      {
        ...basePayload,
        week: 2,
        introSummary: intro,
        weekMatchups: [
          { teamA: "Harks9", scoreA: 120.5, teamB: "Bob", scoreB: 98.1 },
        ],
        weeklySuperlatives: {
          highScore: { teamName: "Harks9", points: 120.5 },
          lowScore: { teamName: "Bob", points: 98.1 },
        },
      },
      { recapReady: true, slateStatus: "final" },
    );
    const html = generateWeeklyEmail(payload);
    expect(intro).toMatch(/in the books/);
    expect(html).toContain("This week's results");
    expect(html).toContain("High score:");
    expect(payload.weekMatchups?.length).toBe(1);
  });
});
