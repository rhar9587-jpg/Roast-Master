import { describe, expect, it } from "vitest";
import { generatePowerRankings, type PowerRankingsTeamInput } from "./powerRankings";
import { generateWeeklyEmail, generateWeeklyEmailPlainText } from "./weeklyEmail";
import { formatRankMovementLabel } from "@shared/rankMovement";

function team(
  id: string,
  name: string,
  powerHint: { wins: number; losses: number; pf: number },
): PowerRankingsTeamInput {
  return {
    teamId: id,
    teamName: name,
    wins: powerHint.wins,
    losses: powerHint.losses,
    pointsFor: powerHint.pf,
    weeklyScores: [
      { week: 1, score: powerHint.pf / 2 },
      { week: 2, score: powerHint.pf / 2 },
    ],
  };
}

describe("power ranking movement + email rendering", () => {
  const teams = [
    team("1", "Alice", { wins: 2, losses: 0, pf: 240 }),
    team("2", "Bob", { wins: 1, losses: 1, pf: 200 }),
    team("3", "Carol", { wins: 1, losses: 1, pf: 180 }),
    team("4", "Dave", { wins: 0, losses: 2, pf: 140 }),
  ];

  it("computes place deltas from prior snapshot (Week 2 vs Week 1)", () => {
    const week1 = generatePowerRankings(teams, []);
    expect(week1.every((r) => r.showMovement === false)).toBe(true);
    expect(week1.every((r) => r.previousRank === null)).toBe(true);

    // Swap Alice (was 1) down and Dave (was 4) up via prior ranks only — force deltas.
    const prior = [
      { teamId: "1", rank: 3 }, // Alice now ~1 → ↑ 2
      { teamId: "2", rank: 2 }, // Bob same-ish
      { teamId: "3", rank: 1 }, // Carol drops
      { teamId: "4", rank: 4 },
    ];
    const week2 = generatePowerRankings(teams, prior);
    const alice = week2.find((r) => r.teamId === "1")!;
    const carol = week2.find((r) => r.teamId === "3")!;
    expect(alice.showMovement).toBe(true);
    expect(alice.previousRank).toBe(3);
    expect(alice.trend).toBe("up");
    expect(alice.placesMoved).toBe(alice.previousRank! - alice.rank);
    expect(formatRankMovementLabel({ state: "up", places: alice.placesMoved })).toBe(
      `↑ ${alice.placesMoved}`,
    );

    expect(carol.showMovement).toBe(true);
    expect(carol.previousRank).toBe(1);
    expect(carol.trend).toBe("down");
    expect(carol.placesMoved).toBe(carol.rank - carol.previousRank!);
  });

  it("email shows ↑ N / ↓ N / Same and suppresses when no prior", () => {
    const withMoveHtml = generateWeeklyEmail({
      leagueName: "Test League",
      week: 2,
      introSummary: "Week 2 is in the books.",
      rankings: [
        {
          rank: 3,
          teamName: "Alice",
          record: "1-1",
          powerScore: 70,
          trend: "up",
          placesMoved: 2,
          showMovement: true,
          commentary: "Climbing.",
        },
        {
          rank: 6,
          teamName: "Bob",
          record: "0-2",
          powerScore: 40,
          trend: "down",
          placesMoved: 2,
          showMovement: true,
          commentary: "Sliding.",
        },
        {
          rank: 2,
          teamName: "Carol",
          record: "2-0",
          powerScore: 85,
          trend: "flat",
          placesMoved: 0,
          showMovement: true,
          commentary: "Steady.",
        },
      ],
    });
    expect(withMoveHtml).toContain("↑ 2");
    expect(withMoveHtml).toContain("↓ 2");
    expect(withMoveHtml).toContain("Same");
    expect(withMoveHtml).not.toContain(">&#8212;<");

    const noPriorHtml = generateWeeklyEmail({
      leagueName: "Test League",
      week: 1,
      introSummary: "Week 1 is in the books.",
      rankings: [
        {
          rank: 1,
          teamName: "Alice",
          record: "1-0",
          powerScore: 90,
          trend: "flat",
          placesMoved: null,
          showMovement: false,
          commentary: "Solid.",
        },
      ],
    });
    expect(noPriorHtml).not.toContain("↑");
    expect(noPriorHtml).not.toContain("↓");
    expect(noPriorHtml).not.toContain("Same");
    expect(noPriorHtml).not.toContain("&#8212;");

    const plain = generateWeeklyEmailPlainText({
      leagueName: "Test League",
      week: 2,
      introSummary: "Week 2 is in the books.",
      rankings: [
        {
          rank: 3,
          teamName: "Alice",
          record: "1-1",
          powerScore: 70,
          trend: "up",
          placesMoved: 2,
          showMovement: true,
          commentary: "Climbing.",
        },
      ],
    });
    expect(plain).toContain("↑ 2");
  });

  it("email / engine / public share use the same place delta values", () => {
    const prior = [
      { teamId: "1", rank: 5 },
      { teamId: "2", rank: 1 },
      { teamId: "3", rank: 3 },
      { teamId: "4", rank: 4 },
    ];
    const rankings = generatePowerRankings(teams, prior);
    const alice = rankings.find((r) => r.teamId === "1")!;
    expect(alice.placesMoved).toBe(alice.previousRank! - alice.rank);
    expect(alice.showMovement).toBe(true);

    const emailRow = {
      rank: alice.rank,
      teamName: alice.teamName,
      record: alice.record,
      powerScore: alice.powerScore,
      trend: alice.trend,
      placesMoved: alice.placesMoved,
      showMovement: alice.showMovement,
      commentary: alice.commentary,
    };
    const html = generateWeeklyEmail({
      leagueName: "Test",
      week: 2,
      introSummary: "x",
      rankings: [emailRow],
    });
    const label = formatRankMovementLabel({
      state: alice.trend === "up" ? "up" : alice.trend === "down" ? "down" : "same",
      places: alice.placesMoved,
    });
    expect(label).toBeTruthy();
    expect(html).toContain(label);
  });
});
