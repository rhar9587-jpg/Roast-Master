import { describe, expect, it } from "vitest";
import { computeWeeklySuperlatives } from "./weeklyCommissioner";
import type { SleeperMatchup } from "../league-history/sleeper";

describe("computeWeeklySuperlatives — bench / sit-start semantics", () => {
  it("omits player-for-player swap claim when positional eligibility is unknown", () => {
    const matchups: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 100,
        starters: ["s1"],
        players: ["s1", "b1"],
        players_points: { s1: 5, b1: 25 },
      },
      {
        roster_id: 2,
        matchup_id: 1,
        points: 90,
        starters: ["s2"],
        players: ["s2", "b2"],
        players_points: { s2: 80, b2: 2 },
      },
    ];
    const names = (id: string) => (id === "1" ? "Dup Name" : "Other");
    const players = {
      s1: { full_name: "Low Starter" },
      b1: { full_name: "Hot Bench" },
      s2: { full_name: "Ace" },
      b2: { full_name: "Scrub" },
    };

    const result = computeWeeklySuperlatives(matchups, names, players, true);
    expect(result?.worstCoach?.teamName).toBe("Dup Name");
    // No positions → findBestSitStartMiss cannot prove a legal swap
    expect(result?.worstCoach?.sitStartMiss).toBeUndefined();
  });

  it("claims a legal sit/start swap only when positions are compatible", () => {
    const matchups: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 100,
        starters: ["s1"],
        players: ["s1", "b1"],
        players_points: { s1: 5, b1: 25 },
      },
      {
        roster_id: 2,
        matchup_id: 1,
        points: 90,
        starters: ["s2"],
        players: ["s2", "b2"],
        players_points: { s2: 80, b2: 2 },
      },
    ];
    const names = (id: string) => (id === "1" ? "Dup Name" : "Other");
    const players = {
      s1: { full_name: "Low RB", position: "RB" },
      b1: { full_name: "Hot RB", position: "RB" },
      s2: { full_name: "Ace", position: "QB" },
      b2: { full_name: "Scrub", position: "WR" },
    };

    const result = computeWeeklySuperlatives(matchups, names, players, true);
    expect(result?.worstCoach?.sitStartMiss).toMatch(/Hot RB \(RB\) should have started over Low RB \(RB\)/);
  });

  it("does not claim an illegal position swap (e.g. WR over QB)", () => {
    const matchups: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 100,
        starters: ["s1"],
        players: ["s1", "b1"],
        players_points: { s1: 5, b1: 25 },
      },
      {
        roster_id: 2,
        matchup_id: 1,
        points: 90,
        starters: ["s2"],
        players: ["s2"],
        players_points: { s2: 80 },
      },
    ];
    const names = () => "Team";
    const players = {
      s1: { full_name: "QB Starter", position: "QB" },
      b1: { full_name: "Hot WR", position: "WR" },
      s2: { full_name: "Ace", position: "RB" },
    };
    const result = computeWeeklySuperlatives(matchups, names, players, true);
    expect(result?.worstCoach?.sitStartMiss ?? "").not.toMatch(/should have started over/i);
  });

  it("picks least bench waste by roster id when display names collide", () => {
    const matchups: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 1,
        points: 100,
        starters: ["a"],
        players: ["a", "b"],
        players_points: { a: 50, b: 40 },
      },
      {
        roster_id: 2,
        matchup_id: 1,
        points: 95,
        starters: ["c"],
        players: ["c", "d"],
        players_points: { c: 90, d: 3 },
      },
    ];
    // Both render as the same display name — exclusion must use roster id.
    const names = () => "Same Name";
    const result = computeWeeklySuperlatives(matchups, names, null, true);
    expect(result?.worstCoach?.benchPoints).toBe(40);
    expect(result?.bestCoach?.benchPoints).toBe(3);
    expect(result?.bestCoach?.teamName).toBe("Same Name");
  });
});
