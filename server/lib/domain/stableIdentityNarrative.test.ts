import { describe, expect, it } from "vitest";
import {
  computeHeroReceipts,
  getLongestConsecutiveSeasonStreak,
} from "../../../client/src/pages/LeagueHistory/computeHeroReceipts";
import type { ManagerRow, SeasonStat, WeeklyMatchupDetail } from "../../../client/src/pages/LeagueHistory/types";

function seasonStat(partial: Partial<SeasonStat> & Pick<SeasonStat, "managerKey" | "season">): SeasonStat {
  return {
    rank: partial.regularSeasonRank ?? -1,
    wins: 6,
    losses: 8,
    totalPF: 1400,
    playoffQualified: false,
    playoffTeams: 6,
    ...partial,
  };
}

const managers: ManagerRow[] = [
  { key: "owner:drought", name: "Drought Manager" },
  { key: "owner:paper", name: "Paper Manager" },
  { key: "owner:choke", name: "Choke Manager" },
  { key: "owner:rename", name: "Current Name" },
];

describe("getLongestConsecutiveSeasonStreak", () => {
  it("does not count non-consecutive years as one drought", () => {
    const stats = [
      seasonStat({ managerKey: "owner:drought", season: "2021", playoffQualified: false }),
      seasonStat({ managerKey: "owner:drought", season: "2022", playoffQualified: false }),
      seasonStat({ managerKey: "owner:drought", season: "2024", playoffQualified: false }),
    ];
    const streak = getLongestConsecutiveSeasonStreak(stats, (s) => !s.playoffQualified);
    expect(streak.length).toBe(2);
    expect(streak.start).toBe("2021");
    expect(streak.end).toBe("2022");
  });

  it("continues only across consecutive calendar years", () => {
    const stats = [
      seasonStat({ managerKey: "owner:drought", season: "2019", playoffQualified: false }),
      seasonStat({ managerKey: "owner:drought", season: "2020", playoffQualified: false }),
      seasonStat({ managerKey: "owner:drought", season: "2021", playoffQualified: false }),
    ];
    const streak = getLongestConsecutiveSeasonStreak(stats, (s) => !s.playoffQualified);
    expect(streak.length).toBe(3);
    expect(streak.start).toBe("2019");
    expect(streak.end).toBe("2021");
  });
});

describe("computeHeroReceipts — narrative semantics", () => {
  it("Paper Champion requires #1 regular-season seed and championshipWon === false", () => {
    const seasonStats: SeasonStat[] = [
      seasonStat({
        managerKey: "owner:paper",
        season: "2024",
        wins: 12,
        losses: 2,
        totalPF: 2000,
        regularSeasonRank: 1,
        championshipWon: false,
        playoffQualified: true,
      }),
      seasonStat({
        managerKey: "owner:choke",
        season: "2024",
        wins: 10,
        losses: 4,
        totalPF: 1800,
        regularSeasonRank: 2,
        championshipWon: true,
        playoffQualified: true,
      }),
    ];
    // Enough weekly rows to mark season complete
    const weekly: WeeklyMatchupDetail[] = [];
    for (let w = 1; w <= 14; w++) {
      weekly.push({
        season: "2024",
        week: w,
        managerKey: "owner:paper",
        opponentKey: "owner:choke",
        points: 100,
        opponentPoints: 90,
        margin: 10,
        won: true,
      });
    }

    const receipts = computeHeroReceipts(seasonStats, weekly, managers, {}, "test-league");
    const paper = receipts.find((r) => r.id === "paper-champion");
    expect(paper).toBeTruthy();
    expect(paper!.name).toBe("Paper Manager");
    expect(paper!.punchline).toMatch(/#1 regular-season seed/i);
    expect(paper!.punchline).not.toMatch(/won the championship/i);
    expect(paper!.lines.some((l) => l.label === "Championship" && l.value === "No")).toBe(true);
  });

  it("Playoff Choker punchline omits unverified bye claims", () => {
    const seasonStats: SeasonStat[] = [
      seasonStat({
        managerKey: "owner:choke",
        season: "2024",
        wins: 11,
        losses: 3,
        regularSeasonRank: 1,
        playoffQualified: true,
        playoffStartWeek: 15,
        playoffWeekEnd: 17,
        championshipWon: false,
      }),
      seasonStat({
        managerKey: "owner:paper",
        season: "2024",
        wins: 9,
        losses: 5,
        regularSeasonRank: 4,
        playoffQualified: true,
        playoffStartWeek: 15,
        playoffWeekEnd: 17,
        championshipWon: true,
      }),
    ];
    const weekly: WeeklyMatchupDetail[] = [];
    for (let w = 1; w <= 14; w++) {
      weekly.push({
        season: "2024",
        week: w,
        managerKey: "owner:choke",
        opponentKey: "owner:paper",
        points: 110,
        opponentPoints: 100,
        margin: 10,
        won: true,
      });
    }
    // Two playoff losses for #1 seed
    weekly.push(
      {
        season: "2024",
        week: 16,
        managerKey: "owner:choke",
        opponentKey: "owner:paper",
        points: 90,
        opponentPoints: 120,
        margin: -30,
        won: false,
      },
      {
        season: "2024",
        week: 17,
        managerKey: "owner:choke",
        opponentKey: "owner:paper",
        points: 95,
        opponentPoints: 115,
        margin: -20,
        won: false,
      },
    );

    const receipts = computeHeroReceipts(seasonStats, weekly, managers, {}, "test-league");
    const choke = receipts.find((r) => r.id === "playoff-choker");
    expect(choke).toBeTruthy();
    expect(choke!.punchline.toLowerCase()).not.toContain("bye");
  });

  it("Playoff Drought uses consecutive years only", () => {
    const seasonStats: SeasonStat[] = [
      seasonStat({ managerKey: "owner:drought", season: "2021", playoffQualified: false, wins: 5, losses: 9 }),
      seasonStat({ managerKey: "owner:drought", season: "2022", playoffQualified: false, wins: 4, losses: 10 }),
      seasonStat({ managerKey: "owner:drought", season: "2024", playoffQualified: false, wins: 6, losses: 8 }),
      // Another manager with a true 3-year consecutive drought — should win the card
      seasonStat({ managerKey: "owner:rename", season: "2020", playoffQualified: false }),
      seasonStat({ managerKey: "owner:rename", season: "2021", playoffQualified: false }),
      seasonStat({ managerKey: "owner:rename", season: "2022", playoffQualified: false }),
    ];
    const receipts = computeHeroReceipts(seasonStats, [], managers, {}, "test-league");
    const drought = receipts.find((r) => r.id === "playoff-drought");
    expect(drought).toBeTruthy();
    expect(drought!.name).toBe("Current Name");
    expect(drought!.primaryStat.value).toBe("3");
  });
});
