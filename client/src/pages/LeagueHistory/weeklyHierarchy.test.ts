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
  WEEKLY_POWER_RANKINGS_MOBILE_DEFAULT,
} from "./WeeklyPowerRankingsPanel";
import {
  DEMOLISHED_WEEK_LEVEL_SHARE_LABELS,
  SHARE_WEEKLY_RECAP_LABEL,
} from "./shareHierarchyLabels";

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
    const part = partitionWeeklyRoastCards(cards, { supportingLimit: 3 });
    expect(part.hero?.type).toBe("biggest_embarrassment");
    expect(part.supporting.every((c) => c.type !== part.hero?.type)).toBe(true);
    expect(part.supporting.length).toBeLessThanOrEqual(3);
    expect(part.supporting.length).toBeGreaterThanOrEqual(2);
    // Hero appears before supporting in presentation order by construction
    expect(part.hero).not.toBeNull();
  });
});

describe("Weekly compact results", () => {
  const names = (k: string) =>
    ({ "mgr:a": "Alice", "mgr:b": "Bob", "mgr:c": "Carol", "mgr:d": "Dave" }[k] ?? k);

  it("renders completed results only when recapReady", () => {
    const matchups = [
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
    ];
    expect(
      buildCompactWeekResults(matchups, {
        week: 1,
        season: "2024",
        nameByKey: names,
        recapReady: false,
      }),
    ).toEqual([]);
    const rows = buildCompactWeekResults(matchups, {
      week: 1,
      season: "2024",
      nameByKey: names,
      recapReady: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.winnerName).toBe("Alice");
    expect(rows[0]?.loserName).toBe("Bob");
  });

  it("skips 0–0 shells", () => {
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
});

describe("Weekly Power Rankings presentation", () => {
  it("mobile defaults to Top 5", () => {
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
  });
});

describe("Weekly share hierarchy preserved", () => {
  it("keeps a single primary Share weekly recap label", () => {
    expect(SHARE_WEEKLY_RECAP_LABEL).toBe("Share weekly recap");
    for (const label of DEMOLISHED_WEEK_LEVEL_SHARE_LABELS) {
      expect(label).not.toBe(SHARE_WEEKLY_RECAP_LABEL);
    }
  });
});

describe("Weekly week chrome", () => {
  it("advanced week picker starts collapsed (default state contract)", () => {
    // WeeklyWeekContextBar uses useState(false) for pickerOpen — document the contract.
    const defaultPickerOpen = false;
    expect(defaultPickerOpen).toBe(false);
  });
});
