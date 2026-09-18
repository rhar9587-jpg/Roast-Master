import { describe, it, expect } from "vitest";
import { canFantasyReplace, findBestSitStartMiss } from "./sitStartMiss";

describe("canFantasyReplace", () => {
  it("allows same-position swaps", () => {
    expect(canFantasyReplace("QB", "QB")).toBe(true);
    expect(canFantasyReplace("K", "K")).toBe(true);
    expect(canFantasyReplace("DEF", "DEF")).toBe(true);
  });

  it("allows flex-compatible RB/WR/TE swaps", () => {
    expect(canFantasyReplace("WR", "RB")).toBe(true);
    expect(canFantasyReplace("TE", "WR")).toBe(true);
    expect(canFantasyReplace("RB", "TE")).toBe(true);
  });

  it("rejects WR↔QB and other illegal swaps", () => {
    expect(canFantasyReplace("WR", "QB")).toBe(false);
    expect(canFantasyReplace("QB", "WR")).toBe(false);
    expect(canFantasyReplace("RB", "QB")).toBe(false);
    expect(canFantasyReplace("WR", "K")).toBe(false);
    expect(canFantasyReplace("TE", "DEF")).toBe(false);
  });
});

describe("findBestSitStartMiss", () => {
  const players = {
    qb1: { full_name: "Starter QB", position: "QB" },
    qb2: { full_name: "Bench QB", position: "QB" },
    wr1: { full_name: "Starter WR", position: "WR" },
    wr2: { full_name: "Bench WR", position: "WR" },
    rb1: { full_name: "Starter RB", position: "RB" },
  };

  it("does not suggest a high-scoring WR over a low QB", () => {
    const miss = findBestSitStartMiss(
      {
        starters: ["qb1", "wr1", "rb1"],
        players: ["qb1", "wr1", "rb1", "wr2"],
        players_points: { qb1: 8, wr1: 12, rb1: 10, wr2: 28 },
      },
      players,
    );
    // Best legal edge is WR→RB (18) or WR→WR (16) — never WR→QB
    expect(miss).not.toBeNull();
    expect(miss!.sitStartMiss).toContain("Bench WR");
    expect(miss!.sitStartMiss).not.toContain("Starter QB");
    expect(miss!.starterPid).not.toBe("qb1");
  });

  it("suggests bench QB over starter QB when positions match", () => {
    const miss = findBestSitStartMiss(
      {
        starters: ["qb1", "wr1"],
        players: ["qb1", "wr1", "qb2"],
        players_points: { qb1: 6, wr1: 14, qb2: 24 },
      },
      players,
    );
    expect(miss?.sitStartMiss).toMatch(/Bench QB \(QB\) should have started over Starter QB \(QB\)/);
  });

  it("returns null when no legal outscoring swap exists", () => {
    const miss = findBestSitStartMiss(
      {
        starters: ["qb1", "wr1"],
        players: ["qb1", "wr1", "wr2"],
        players_points: { qb1: 20, wr1: 18, wr2: 10 },
      },
      players,
    );
    expect(miss).toBeNull();
  });
});
