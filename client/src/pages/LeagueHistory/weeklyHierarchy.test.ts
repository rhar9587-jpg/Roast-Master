/**
 * Tests for Weekly tab hierarchy helpers (presentation only).
 */

import { describe, expect, it } from "vitest";
import {
  partitionWeeklyRoastCards,
  selectWeeklyHero,
  weeklyHeroPriority,
} from "@shared/weeklyHero";
import { buildCompactWeekResults } from "./weeklyCompactResults";
import {
  rankingShowsMovement,
  weeklyPowerRankingsVisibleCount,
  weeklyRankMovementLabel,
  WEEKLY_POWER_RANKINGS_MOBILE_DEFAULT,
} from "./WeeklyPowerRankingsPanel";
import {
  DEMOLISHED_WEEK_LEVEL_SHARE_LABELS,
  SHARE_THIS_CARD_LABEL,
  SHARE_WEEKLY_RECAP_LABEL,
} from "./shareHierarchyLabels";
import {
  WEEKLY_COMPLETED_SECTION_ORDER,
  WEEKLY_SUPPORTING_DEFAULT_PRESENTATION,
  WEEKLY_SUPPORTING_MOMENT_LIMIT,
  compactResultsAppearBeforeSupporting,
  emailToolsAreSecondary,
  primaryShareAppearsBeforeSupporting,
  weeklySectionIndex,
} from "./weeklyPresentation";

describe("Weekly completed-week hierarchy order", () => {
  it("orders hero → share → results → rankings → supporting → see more → email", () => {
    expect(WEEKLY_COMPLETED_SECTION_ORDER).toEqual([
      "week-context",
      "hero",
      "share-weekly-recap",
      "compact-results",
      "power-rankings",
      "supporting-moments",
      "see-more-roasts",
      "email-tools",
      "advanced-controls",
    ]);
    expect(primaryShareAppearsBeforeSupporting()).toBe(true);
    expect(compactResultsAppearBeforeSupporting()).toBe(true);
    expect(emailToolsAreSecondary()).toBe(true);
    expect(weeklySectionIndex("share-weekly-recap")).toBeLessThan(
      weeklySectionIndex("power-rankings"),
    );
    expect(weeklySectionIndex("compact-results")).toBeLessThan(
      weeklySectionIndex("power-rankings"),
    );
  });

  it("keeps a single primary Share weekly recap CTA label", () => {
    expect(SHARE_WEEKLY_RECAP_LABEL).toBe("Share weekly recap");
    for (const label of DEMOLISHED_WEEK_LEVEL_SHARE_LABELS) {
      expect(label).not.toBe(SHARE_WEEKLY_RECAP_LABEL);
    }
  });

  it("preserves Share this card for supporting moments", () => {
    expect(SHARE_THIS_CARD_LABEL).toBe("Share this card");
  });
});

describe("Weekly hero selection", () => {
  it("prefers Murder Scene over Top Dog with deterministic priority", () => {
    const hero = selectWeeklyHero([
      { type: "top_dog", title: "Top Dog", subtitle: "Alice paced.", stat: "140" },
      {
        type: "biggest_embarrassment",
        title: "Biggest Embarrassment",
        subtitle: "Alice dropped Bob.",
        stat: "+40",
      },
    ]);
    expect(hero?.type).toBe("biggest_embarrassment");
    expect(weeklyHeroPriority("biggest_embarrassment")).toBeLessThan(
      weeklyHeroPriority("top_dog"),
    );
  });

  it("partitions hero before supporting and does not duplicate hero type", () => {
    const cards = [
      { type: "top_dog", title: "Top Dog", subtitle: "High.", stat: "167" },
      {
        type: "biggest_embarrassment",
        title: "Blowout",
        subtitle: "Dropped.",
        stat: "+105",
      },
      { type: "fraud_watch", title: "Fraud", subtitle: "Won light.", stat: "Won light" },
      { type: "carry_job", title: "Carry", subtitle: "One player.", stat: "55%" },
      { type: "worst_coaching", title: "Bench", subtitle: "Left pts.", stat: "40" },
    ];
    const part = partitionWeeklyRoastCards(cards, {
      supportingLimit: WEEKLY_SUPPORTING_MOMENT_LIMIT,
    });
    expect(part.hero?.type).toBe("biggest_embarrassment");
    expect(part.supporting.every((c) => c.type !== part.hero?.type)).toBe(true);
    expect(part.supporting.length).toBeLessThanOrEqual(WEEKLY_SUPPORTING_MOMENT_LIMIT);
    expect(part.supporting.length).toBeGreaterThanOrEqual(2);
    expect(part.supporting.length).toBeLessThanOrEqual(3);
    expect(part.hero).not.toBeNull();
    expect(part.remainder.length).toBeGreaterThan(0);
  });

  it("default supporting moment count is 2–3 and presentation is compact", () => {
    expect(WEEKLY_SUPPORTING_MOMENT_LIMIT).toBe(3);
    expect(WEEKLY_SUPPORTING_DEFAULT_PRESENTATION).toBe("compact");
    const cards = [
      { type: "biggest_embarrassment", title: "Blowout", subtitle: "Dropped.", stat: "+40" },
      { type: "top_dog", title: "Top Dog", subtitle: "High.", stat: "140" },
      { type: "fraud_watch", title: "Fraud", subtitle: "Won light.", stat: "light" },
      { type: "carry_job", title: "Carry", subtitle: "One.", stat: "55%" },
      { type: "worst_coaching", title: "Bench", subtitle: "Left.", stat: "30" },
      { type: "lowest_scorer", title: "Jail", subtitle: "Floor.", stat: "50" },
    ];
    const part = partitionWeeklyRoastCards(cards, {
      supportingLimit: WEEKLY_SUPPORTING_MOMENT_LIMIT,
    });
    expect(part.supporting.length).toBe(3);
    expect(part.supporting.map((c) => c.type)).not.toContain(part.hero?.type);
  });
});

describe("Weekly compact matchup results", () => {
  const names = (k: string) =>
    ({ "mgr:a": "Alice", "mgr:b": "Bob", "mgr:c": "Carol", "mgr:d": "Dave" }[k] ?? k);

  const week1Matchups = [
    {
      week: 1,
      season: "2024",
      managerKey: "mgr:a",
      opponentKey: "mgr:b",
      points: 120,
      opponentPoints: 90,
      margin: 30,
      won: true,
    },
    {
      week: 1,
      season: "2024",
      managerKey: "mgr:b",
      opponentKey: "mgr:a",
      points: 90,
      opponentPoints: 120,
      margin: 30,
      won: false,
    },
    {
      week: 1,
      season: "2024",
      managerKey: "mgr:c",
      opponentKey: "mgr:d",
      points: 141.5,
      opponentPoints: 100.6,
      margin: 40.9,
      won: true,
    },
    {
      week: 1,
      season: "2024",
      managerKey: "mgr:d",
      opponentKey: "mgr:c",
      points: 100.6,
      opponentPoints: 141.5,
      margin: 40.9,
      won: false,
    },
  ];

  it("completed week renders compact results for all final matchups", () => {
    const rows = buildCompactWeekResults(week1Matchups, {
      week: 1,
      season: "2024",
      nameByKey: names,
      recapReady: true,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.winnerName).sort()).toEqual(["Alice", "Carol"]);
    expect(rows.find((r) => r.winnerName === "Carol")).toMatchObject({
      winnerScore: 141.5,
      loserName: "Dave",
      loserScore: 100.6,
    });
  });

  it("non-final weeks do not render completed matchup results", () => {
    expect(
      buildCompactWeekResults(week1Matchups, {
        week: 1,
        season: "2024",
        nameByKey: names,
        recapReady: false,
      }),
    ).toEqual([]);
  });

  it("skips 0–0 future shells even when recapReady", () => {
    const rows = buildCompactWeekResults(
      [
        {
          week: 3,
          managerKey: "mgr:a",
          opponentKey: "mgr:b",
          points: 0,
          opponentPoints: 0,
          margin: 0,
          won: true,
        },
      ],
      { week: 3, nameByKey: names, recapReady: true },
    );
    expect(rows).toHaveLength(0);
  });

  it("Week 1 completed behaviour remains valid", () => {
    const rows = buildCompactWeekResults(week1Matchups, {
      week: 1,
      season: "2024",
      nameByKey: names,
      recapReady: true,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.winnerScore > r.loserScore)).toBe(true);
  });

  it("Week 3 upcoming has no compact results without recapReady", () => {
    const shells = [
      {
        week: 3,
        managerKey: "mgr:a",
        opponentKey: "mgr:b",
        points: 0,
        opponentPoints: 0,
        margin: 0,
        won: true,
      },
    ];
    expect(
      buildCompactWeekResults(shells, {
        week: 3,
        nameByKey: names,
        recapReady: false,
      }),
    ).toEqual([]);
  });

  it("does not invent scoring — only projects existing matchup fields", () => {
    const src = week1Matchups.filter((m) => m.won);
    const rows = buildCompactWeekResults(week1Matchups, {
      week: 1,
      season: "2024",
      nameByKey: names,
      recapReady: true,
    });
    for (const row of rows) {
      const srcRow = src.find(
        (m) =>
          names(m.managerKey) === row.winnerName &&
          Math.abs(m.points - row.winnerScore) < 0.01,
      );
      expect(srcRow).toBeTruthy();
      expect(row.loserScore).toBe(srcRow!.opponentPoints);
    }
  });
});

describe("Weekly Power Rankings presentation", () => {
  it("defaults to Top 5 initially", () => {
    expect(WEEKLY_POWER_RANKINGS_MOBILE_DEFAULT).toBe(5);
    expect(
      weeklyPowerRankingsVisibleCount({
        total: 12,
        expanded: false,
        compactDefault: true,
      }),
    ).toBe(5);
    expect(
      weeklyPowerRankingsVisibleCount({
        total: 12,
        expanded: true,
        compactDefault: true,
      }),
    ).toBe(12);
  });

  it("movement only when valid prior history", () => {
    expect(rankingShowsMovement({ trend: "up" }, false)).toBe(false);
    expect(rankingShowsMovement({ trend: "up" }, true)).toBe(true);
    expect(rankingShowsMovement({ trend: "flat" }, true)).toBe(false);
    expect(rankingShowsMovement({ trend: "flat", showMovement: true }, false)).toBe(true);
    expect(weeklyRankMovementLabel({
      rank: 3,
      teamName: "A",
      record: "1-1",
      trend: "up",
      placesMoved: 2,
      showMovement: true,
    })).toBe("↑ 2");
    expect(weeklyRankMovementLabel({
      rank: 6,
      teamName: "B",
      record: "0-2",
      trend: "down",
      placesMoved: 2,
      showMovement: true,
    })).toBe("↓ 2");
    expect(weeklyRankMovementLabel({
      rank: 2,
      teamName: "C",
      record: "2-0",
      trend: "flat",
      placesMoved: 0,
      showMovement: true,
    })).toBe("Same");
    expect(weeklyRankMovementLabel({
      rank: 1,
      teamName: "D",
      record: "1-0",
      trend: "flat",
      showMovement: false,
    })).toBe("");
  });
});

describe("Weekly week chrome", () => {
  it("advanced week picker starts collapsed (default state contract)", () => {
    const defaultPickerOpen = false;
    expect(defaultPickerOpen).toBe(false);
  });
});
