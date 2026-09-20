import { describe, expect, it } from "vitest";
import {
  UNKNOWN_PLAYER_DISPLAY,
  clearPlayerNameCacheForTests,
  displayNameFromSleeperPlayer,
  looksLikeRawPlayerIdFallback,
  resolvePlayerDisplayName,
} from "./weeklyRoastEngine";

describe("Carry Job player-name resolution (weeklyRoastEngine re-exports)", () => {
  it("resolves a real name from the full NFL map (e.g. ID 6804)", () => {
    const name = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: {
        player_id: "6804",
        full_name: "Josh Allen",
        position: "QB",
        team: "BUF",
      },
      decoratePositionTeam: true,
    });
    expect(name).toBe("Josh Allen (QB, BUF)");
    expect(looksLikeRawPlayerIdFallback(name)).toBe(false);
    expect(name).not.toMatch(/6804/);
  });

  it("uses first+last when full_name is missing on the map entry", () => {
    const name = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: {
        first_name: "Josh",
        last_name: "Allen",
        position: "QB",
        team: "BUF",
      },
      decoratePositionTeam: true,
    });
    expect(name).toBe("Josh Allen (QB, BUF)");
  });

  it("falls back to individual lookup when the full map misses the ID", () => {
    const name = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: null,
      fromIndividual: {
        full_name: "Josh Allen",
        position: "QB",
        team: "BUF",
      },
      decoratePositionTeam: true,
    });
    expect(name).toBe("Josh Allen (QB, BUF)");
    expect(name).not.toMatch(/Player\s+6804/i);
  });

  it("never returns Player <id> when both lookups fail", () => {
    const name = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: null,
      fromIndividual: null,
    });
    expect(name).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(looksLikeRawPlayerIdFallback(name)).toBe(false);
    expect(name).not.toMatch(/\d/);
  });

  it("displayNameFromSleeperPlayer returns null rather than Player <id>", () => {
    expect(displayNameFromSleeperPlayer(null)).toBeNull();
    expect(displayNameFromSleeperPlayer({})).toBeNull();
    expect(displayNameFromSleeperPlayer({ player_id: "6804" } as never)).toBeNull();
  });

  it("detects banned raw-ID fallback strings", () => {
    expect(looksLikeRawPlayerIdFallback("Player 6804")).toBe(true);
    expect(looksLikeRawPlayerIdFallback("Josh Allen (QB, BUF)")).toBe(false);
    expect(looksLikeRawPlayerIdFallback(UNKNOWN_PLAYER_DISPLAY)).toBe(false);
  });

  it("clearPlayerNameCacheForTests is available so failed lookups need not poison cache", () => {
    clearPlayerNameCacheForTests();
    const first = resolvePlayerDisplayName({ playerId: "6804" });
    const second = resolvePlayerDisplayName({ playerId: "6804" });
    expect(first).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(second).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(first).not.toMatch(/Player\s+6804/i);
  });
});
