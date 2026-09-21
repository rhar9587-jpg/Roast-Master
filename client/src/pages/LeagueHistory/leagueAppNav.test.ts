import { describe, expect, it } from "vitest";
import {
  buildLeagueAppPath,
  isPlausibleLeagueId,
  parseLeagueAppSearch,
  parseLeagueAppTab,
  pickResumeLeague,
  resumeContinueTitle,
  resumeSupportingLine,
} from "./leagueAppNav";
import { resolveDefaultWeeklyContext } from "./weeklyContext";

describe("league selection → Weekly", () => {
  it("builds a Weekly path by default", () => {
    const path = buildLeagueAppPath({ leagueId: "1389437091309432832" });
    expect(path).toContain("/league-history/dominance?");
    expect(path).toContain("league_id=1389437091309432832");
    expect(path).toContain("tab=weekly");
  });

  it("Receipts remains directly navigable", () => {
    const path = buildLeagueAppPath({
      leagueId: "1389437091309432832",
      tab: "history",
    });
    expect(path).toContain("tab=history");
    expect(parseLeagueAppSearch(path.slice(path.indexOf("?"))).tab).toBe("history");
  });

  it("switching leagues still targets Weekly", () => {
    const a = buildLeagueAppPath({ leagueId: "aaa" });
    const b = buildLeagueAppPath({ leagueId: "bbb" });
    expect(a).toContain("tab=weekly");
    expect(b).toContain("tab=weekly");
    expect(b).toContain("league_id=bbb");
  });
});

describe("Weekly week defaults (canonical)", () => {
  it("Weekly defaults to latest completed week", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 2,
        recapWeek: 2,
        previewWeek: 3,
      }),
    ).toEqual({ mode: "recap", week: 2 });
  });

  it("no completed week → relevant upcoming/live week", () => {
    expect(
      resolveDefaultWeeklyContext({
        latestFinalWeek: 0,
        recapWeek: 1,
        previewWeek: 1,
      }),
    ).toEqual({ mode: "preview", week: 1 });
  });
});

describe("refresh / deep-link preserves Weekly", () => {
  it("parses tab + week + email_mode from the query string", () => {
    const parsed = parseLeagueAppSearch(
      "?league_id=1389437091309432832&tab=weekly&week=1&email_mode=recap&start_week=1&end_week=17",
    );
    expect(parsed.leagueId).toBe("1389437091309432832");
    expect(parsed.tab).toBe("weekly");
    expect(parsed.week).toBe(1);
    expect(parsed.emailMode).toBe("recap");
  });

  it("manual week selection is preserved in the built path", () => {
    const path = buildLeagueAppPath({
      leagueId: "lg",
      tab: "weekly",
      week: 4,
      emailMode: "preview",
    });
    const parsed = parseLeagueAppSearch(path.slice(path.indexOf("?")));
    expect(parsed.week).toBe(4);
    expect(parsed.emailMode).toBe("preview");
    expect(parsed.tab).toBe("weekly");
  });

  it("finality-state labels remain correct via tab parse", () => {
    expect(parseLeagueAppTab("weekly")).toBe("weekly");
    expect(parseLeagueAppTab("history")).toBe("history");
    expect(parseLeagueAppTab("nope")).toBeNull();
  });
});

describe("returning-user resume", () => {
  it("returning user sees Continue <league>", () => {
    expect(resumeContinueTitle("NFL Downunder")).toBe("Continue NFL Downunder");
    expect(resumeContinueTitle("")).toBe("Continue your league");
  });

  it("Continue opens Weekly path", () => {
    const path = buildLeagueAppPath({
      leagueId: "1389437091309432832",
      tab: "weekly",
      week: 1,
      emailMode: "recap",
    });
    expect(path).toContain("tab=weekly");
    expect(resumeSupportingLine({ latestFinalWeek: 1 })).toContain("Week 1");
  });

  it("stale stored league fails gracefully", () => {
    expect(isPlausibleLeagueId("")).toBe(false);
    expect(isPlausibleLeagueId("??")).toBe(false);
    expect(isPlausibleLeagueId("not a league!")).toBe(false);
    expect(
      pickResumeLeague([
        { leagueId: "" },
        { leagueId: "!!!" },
        { leagueId: "1389437091309432832" },
      ])?.leagueId,
    ).toBe("1389437091309432832");
    expect(pickResumeLeague([{ leagueId: "" }, { leagueId: "x" }])).toBeNull();
  });

  it("first-time user has no resume league", () => {
    expect(pickResumeLeague([])).toBeNull();
  });
});
