import { describe, expect, it } from "vitest";
import {
  UNKNOWN_PLAYER_DISPLAY,
  displayNameFromSleeperPlayer,
  looksLikeRawPlayerIdFallback,
  resolvePlayerDisplayName,
  resolvePlayerDisplayNameFromMap,
} from "./playerDisplayName";
import { clearPlayerNameCacheForTests } from "./weeklyRoastEngine";
import { computeWeeklySuperlatives } from "./weeklyCommissioner";
import { generateWeeklyEmail, generateWeeklyEmailPlainText } from "./weeklyEmail";
import { findBestSitStartMiss } from "./sitStartMiss";
import type { SleeperMatchup } from "../league-history/sleeper";

describe("shared player display-name resolution", () => {
  it("resolves a real name from the full NFL map (e.g. ID 6804)", () => {
    const name = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: {
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
  });

  it("never returns Player <id> when both lookups fail", () => {
    const name = resolvePlayerDisplayName({ playerId: "6804" });
    expect(name).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(name).not.toMatch(/Player\s+6804/i);
    expect(name).not.toMatch(/\d/);
  });

  it("map helper returns null rather than Player <id>", () => {
    expect(resolvePlayerDisplayNameFromMap("6804", null)).toBeNull();
    expect(resolvePlayerDisplayNameFromMap("6804", {})).toBeNull();
    expect(displayNameFromSleeperPlayer({ player_id: "6804" } as never)).toBeNull();
  });

  it("failed resolve does not invent cacheable raw-ID text", () => {
    clearPlayerNameCacheForTests();
    const first = resolvePlayerDisplayName({ playerId: "6804" });
    const second = resolvePlayerDisplayName({ playerId: "6804" });
    expect(first).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(second).toBe(UNKNOWN_PLAYER_DISPLAY);
    expect(looksLikeRawPlayerIdFallback(first)).toBe(false);
  });
});

describe("Carry Job / commissioner surfaces never expose raw IDs", () => {
  const rosterName = (teamId: string) => (teamId === "1" ? "mattzhang3366" : `Team ${teamId}`);

  const highRow: SleeperMatchup = {
    roster_id: 1,
    matchup_id: 1,
    points: 140,
    starters: ["6804", "4046"],
    players: ["6804", "4046"],
    players_points: { "6804": 32, "4046": 18 },
  };

  const lowRow: SleeperMatchup = {
    roster_id: 2,
    matchup_id: 1,
    points: 80,
    starters: ["1"],
    players: ["1"],
    players_points: { "1": 10 },
  };

  it("key performers omit unresolved players instead of Player <id>", () => {
    const supers = computeWeeklySuperlatives([highRow, lowRow], rosterName, null, true);
    expect(supers?.highScore.keyPerformers).toBeUndefined();
    const withMap = computeWeeklySuperlatives(
      [highRow, lowRow],
      rosterName,
      {
        "6804": { full_name: "Josh Allen", position: "QB" },
        "4046": { full_name: "Stefon Diggs", position: "WR" },
      },
      true,
    );
    expect(withMap?.highScore.keyPerformers).toEqual(["Josh Allen", "Stefon Diggs"]);
    expect(JSON.stringify(withMap)).not.toMatch(/Player\s+\d+/i);
  });

  it("commissioner HTML/plain text do not expose raw player IDs", () => {
    const email = generateWeeklyEmail({
      leagueName: "Test League",
      week: 8,
      season: "2025",
      introSummary: "Week 8 is in the books.",
      rankings: [
        {
          rank: 1,
          previousRank: 1,
          teamName: "mattzhang3366",
          teamId: "1",
          record: "5-2",
          pointsFor: 900,
          pointsAgainst: 800,
          avgPoints: 128,
          commentary: "Solid.",
        },
      ],
      weeklySuperlatives: {
        highScore: {
          teamName: "mattzhang3366",
          points: 140,
          keyPerformers: ["Josh Allen", "Stefon Diggs"],
        },
        lowScore: { teamName: "Other", points: 80 },
      },
      positionLeaders: [
        { position: "QB", playerName: "Josh Allen", avgPoints: 24.5, teamName: "mattzhang3366" },
      ],
    });
    const plain = generateWeeklyEmailPlainText({
      leagueName: "Test League",
      week: 8,
      season: "2025",
      introSummary: "Week 8 is in the books.",
      rankings: [
        {
          rank: 1,
          previousRank: 1,
          teamName: "mattzhang3366",
          teamId: "1",
          record: "5-2",
          pointsFor: 900,
          pointsAgainst: 800,
          avgPoints: 128,
          commentary: "Solid.",
        },
      ],
      weeklySuperlatives: {
        highScore: {
          teamName: "mattzhang3366",
          points: 140,
          keyPerformers: ["Josh Allen"],
        },
        lowScore: { teamName: "Other", points: 80 },
      },
      positionLeaders: [
        { position: "QB", playerName: "Josh Allen", avgPoints: 24.5, teamName: "mattzhang3366" },
      ],
    });
    expect(email).toContain("Josh Allen");
    expect(email).not.toMatch(/Player\s+\d+/i);
    expect(plain).not.toMatch(/Player\s+\d+/i);
  });

  it("sit/start miss omits unresolved names instead of Player <id>", () => {
    const miss = findBestSitStartMiss(
      {
        starters: ["qb1", "wr1"],
        players: ["qb1", "wr1", "wr2"],
        players_points: { qb1: 8, wr1: 5, wr2: 20 },
      },
      {
        wr1: { position: "WR" },
        wr2: { position: "WR" },
        // names missing on purpose
      },
    );
    expect(miss).toBeNull();
  });

  it("Carry Job copy template never includes Player 6804", () => {
    const resolved = resolvePlayerDisplayName({
      playerId: "6804",
      fromMap: { full_name: "Josh Allen", position: "QB", team: "BUF" },
      decoratePositionTeam: true,
    });
    const subtitle = `mattzhang3366 was basically ${resolved} + vibes.`;
    expect(subtitle).toContain("Josh Allen");
    expect(subtitle).not.toMatch(/Player\s+6804/i);

    const failed = resolvePlayerDisplayName({ playerId: "6804" });
    const failedSub = `mattzhang3366 was basically ${failed} + vibes.`;
    expect(failedSub).toContain(UNKNOWN_PLAYER_DISPLAY);
    expect(failedSub).not.toMatch(/Player\s+6804/i);
  });
});
