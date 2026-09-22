import { describe, expect, it } from "vitest";
import {
  formatRankMovementLabel,
  resolveRankMovement,
  resolveRankMovementFromPrior,
} from "./rankMovement";

describe("resolveRankMovement", () => {
  it("rank 3 vs prior 5 → up 2", () => {
    expect(resolveRankMovement(3, 5)).toEqual({
      state: "up",
      places: 2,
      previousRank: 5,
      trend: "up",
    });
    expect(formatRankMovementLabel(resolveRankMovement(3, 5))).toBe("↑ 2");
  });

  it("rank 6 vs prior 4 → down 2", () => {
    expect(resolveRankMovement(6, 4)).toEqual({
      state: "down",
      places: 2,
      previousRank: 4,
      trend: "down",
    });
    expect(formatRankMovementLabel(resolveRankMovement(6, 4))).toBe("↓ 2");
  });

  it("unchanged rank → Same", () => {
    expect(resolveRankMovement(2, 2)).toEqual({
      state: "same",
      places: 0,
      previousRank: 2,
      trend: "flat",
    });
    expect(formatRankMovementLabel(resolveRankMovement(2, 2))).toBe("Same");
  });

  it("no prior → suppress movement (empty label)", () => {
    expect(resolveRankMovement(1, null).state).toBe("none");
    expect(formatRankMovementLabel(resolveRankMovement(1, null))).toBe("");
    expect(formatRankMovementLabel(resolveRankMovement(1, undefined))).toBe("");
  });
});

describe("resolveRankMovementFromPrior", () => {
  it("Week 2 compares against Week 1 snapshot by teamId", () => {
    const prior = [
      { teamId: "a", rank: 5 },
      { teamId: "b", rank: 4 },
      { teamId: "c", rank: 2 },
    ];
    expect(resolveRankMovementFromPrior("a", 3, prior)).toMatchObject({
      state: "up",
      places: 2,
    });
    expect(resolveRankMovementFromPrior("b", 6, prior)).toMatchObject({
      state: "down",
      places: 2,
    });
    expect(resolveRankMovementFromPrior("c", 2, prior)).toMatchObject({
      state: "same",
      places: 0,
    });
    expect(resolveRankMovementFromPrior("new", 1, prior).state).toBe("none");
    expect(resolveRankMovementFromPrior("a", 3, []).state).toBe("none");
  });
});
