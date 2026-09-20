/**
 * Cross-surface demo fixture invariants.
 *
 * same demo league + same week + same metric scope = same value everywhere
 */

import { describe, expect, it } from "vitest";
import {
  DEMO_MANAGERS,
  DEMO_ICONIC_WEEK,
  DEMO_ICONIC_SEASON,
  DEMO_2024_WINNERS_BRACKET,
  getCanonicalWeeklyMatchups,
  getSleeperMatchupsForDemoWeek,
  managerRecordFromWeekly,
  h2hTotalsForManager,
  isCanonicalDemoTeamName,
  getRegularSeasonWeeklyMatchups,
} from "./demo/canonicalDemoFixture";
import {
  getDemoLeagueData,
  getDemoWeeklyRoast,
  getDemoWeeklyEmailPayload,
  getDemoWrapped,
  getDemoAutopsy,
  getDemoPowerRankingInputs,
  getDemoWeekScoreboard,
  getDemoLandlordAllTimeRecord,
} from "./demoLeague";
import { generatePowerRankings } from "../lib/powerRankings";
import { classifyWeekMatchupPairs } from "../lib/domain/classifyWeekMatchups";
import { matchupFinalityTruth } from "../lib/domain/matchupOutcomes";
import { buildSeasonOutcomes } from "../lib/domain/seasonOutcome";
import { computePersonalHookCard } from "../../client/src/pages/LeagueHistory/computePersonalHookCard";

const LANDLORD_KEY = "mgr:landlord";
const CANONICAL_NAMES = new Set(DEMO_MANAGERS.map((m) => m.name));

function collectTeamNames(value: unknown, out: string[] = []): string[] {
  if (value == null) return out;
  if (typeof value === "string") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectTeamNames(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        (k === "teamName" || k === "team" || k === "winner" || k === "loser" || k === "opponent") &&
        typeof v === "string"
      ) {
        out.push(v);
      } else {
        collectTeamNames(v, out);
      }
    }
  }
  return out;
}

describe("canonical demo fixture", () => {
  it("Landlord H2H totals and expanded weekly all-time record agree (87–42)", () => {
    const { fromH2h, fromWeekly } = getDemoLandlordAllTimeRecord();
    expect(fromH2h.wins).toBe(87);
    expect(fromH2h.losses).toBe(42);
    expect(fromWeekly.wins).toBe(87);
    expect(fromWeekly.losses).toBe(42);
    expect(fromWeekly.wins).toBe(fromH2h.wins);
    expect(fromWeekly.losses).toBe(fromH2h.losses);
  });

  it("League History grid totals match weekly-derived all-time record for Landlord", () => {
    const data = getDemoLeagueData();
    const row = data.totalsByManager.find((t) => t.key === LANDLORD_KEY);
    expect(row).toBeTruthy();
    expect(row!.totalWins).toBe(87);
    expect(row!.totalLosses).toBe(42);

    const fromWeekly = managerRecordFromWeekly(LANDLORD_KEY, data.weeklyMatchups);
    expect(fromWeekly.wins).toBe(row!.totalWins);
    expect(fromWeekly.losses).toBe(row!.totalLosses);
  });

  it("iconic week 8 has a complete 12-team slate", () => {
    const rows = getSleeperMatchupsForDemoWeek(DEMO_ICONIC_SEASON, DEMO_ICONIC_WEEK);
    expect(rows).toHaveLength(12);
    expect(rows.find((r) => r.roster_id === 1)?.points).toBe(167.4);
    expect(rows.find((r) => r.roster_id === 12)?.points).toBe(62.1);
  });
});

describe("demo cross-surface week invariants", () => {
  const week = DEMO_ICONIC_WEEK;

  it("Weekly Roast and Commissioner Email use identical team scores", async () => {
    const roast = await getDemoWeeklyRoast({ week });
    const email = await getDemoWeeklyEmailPayload(week);
    const board = getDemoWeekScoreboard(week);

    for (const [name, pts] of Object.entries(board.scoresByName)) {
      const emailRow = email.weekMatchups?.find(
        (m) => m.teamA === name || m.teamB === name,
      );
      expect(emailRow).toBeTruthy();
      const emailPts = emailRow!.teamA === name ? emailRow!.scoreA : emailRow!.scoreB;
      expect(emailPts).toBe(pts);
    }

    expect(roast.stats.highestScorer.score).toBe(board.highScorer!.points);
    expect(roast.stats.lowestScorer.score).toBe(board.lowScorer!.points);
    expect(email.weeklySuperlatives?.highScore.points).toBe(board.highScorer!.points);
    expect(email.weeklySuperlatives?.lowScore.points).toBe(board.lowScorer!.points);
    expect(email.weeklySuperlatives?.highScore.teamName).toBe(board.highScorer!.name);
    expect(email.weeklySuperlatives?.lowScore.teamName).toBe(board.lowScorer!.name);
  });

  it("Power ranking inputs use the same weekly matchups as demo roast", async () => {
    const roast = await getDemoWeeklyRoast({ week });
    const { teams } = getDemoPowerRankingInputs(DEMO_ICONIC_SEASON, week);
    const board = getDemoWeekScoreboard(week);

    for (const team of teams) {
      const rid = Number(team.teamId);
      const expected = board.scoresByRosterId[rid];
      expect(expected).toBeDefined();
      const weekScore = team.weeklyScores?.find((w) => w.week === week);
      expect(weekScore?.score).toBe(expected);
    }

    // High/low from roast must match power-ranking week scores
    const scores = teams.map((t) => {
      const ws = t.weeklyScores?.find((w) => w.week === week);
      return { name: t.teamName, score: ws?.score ?? 0 };
    });
    const high = [...scores].sort((a, b) => b.score - a.score)[0]!;
    const low = [...scores].sort((a, b) => a.score - b.score)[0]!;
    expect(high.score).toBe(roast.stats.highestScorer.score);
    expect(low.score).toBe(roast.stats.lowestScorer.score);
  });

  it("Roast + Email + Power Rankings agree on scores, winners/ties, high/low", async () => {
    const roast = await getDemoWeeklyRoast({ week });
    const email = await getDemoWeeklyEmailPayload(week);
    const { teams } = getDemoPowerRankingInputs(DEMO_ICONIC_SEASON, week);
    const matchups = getSleeperMatchupsForDemoWeek(DEMO_ICONIC_SEASON, week);
    const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal: true });
    const rankings = generatePowerRankings(teams);

    const board = getDemoWeekScoreboard(week);
    expect(roast.stats.highestScorer.username).toBe(board.highScorer!.name);
    expect(email.weeklySuperlatives?.highScore.teamName).toBe(board.highScorer!.name);
    expect(roast.stats.lowestScorer.username).toBe(board.lowScorer!.name);
    expect(email.weeklySuperlatives?.lowScore.teamName).toBe(board.lowScorer!.name);

    for (const pair of pairs) {
      expect(["completed", "tie", "scheduled", "in_progress", "malformed"]).toContain(
        pair.classification.status,
      );
      if (pair.classification.status === "completed") {
        const winnerId = pair.classification.winner.rosterId;
        const winnerName = DEMO_MANAGERS.find((m) => m.rosterId === winnerId)!.name;
        const emailPair = email.weekMatchups?.find(
          (m) =>
            (m.teamA === winnerName || m.teamB === winnerName) &&
            Math.max(m.scoreA, m.scoreB) === board.scoresByRosterId[winnerId],
        );
        expect(emailPair).toBeTruthy();
      }
    }

    expect(rankings).toHaveLength(12);
    for (const r of rankings) {
      expect(CANONICAL_NAMES.has(r.teamName)).toBe(true);
    }
  });
});

describe("demo team identity", () => {
  it("no demo team name appears unless it exists in canonical managers", async () => {
    const surfaces = [
      getDemoLeagueData(),
      await getDemoWeeklyRoast({ week: DEMO_ICONIC_WEEK }),
      await getDemoWeeklyEmailPayload(DEMO_ICONIC_WEEK),
      getDemoWrapped({ roster_id: 1 }),
      getDemoAutopsy(),
    ];
    for (const surface of surfaces) {
      const names = collectTeamNames(surface);
      for (const name of names) {
        expect(CANONICAL_NAMES.has(name), `invented team: ${name}`).toBe(true);
      }
    }
    expect(isCanonicalDemoTeamName("Cash Cons")).toBe(false);
    expect(isCanonicalDemoTeamName("Underachievers")).toBe(false);
    expect(isCanonicalDemoTeamName("The Landlord")).toBe(true);
  });

  it("all demo surfaces use only canonical roster/team IDs", async () => {
    const canonicalIds = new Set(DEMO_MANAGERS.map((m) => m.rosterId));
    const roast = await getDemoWeeklyRoast({ week: DEMO_ICONIC_WEEK, roster_id: 1 });
    expect(canonicalIds.has(roast.stats.highestScorer.roster_id)).toBe(true);
    expect(canonicalIds.has(roast.stats.lowestScorer.roster_id)).toBe(true);
    if (roast.matchup) {
      expect(canonicalIds.has((roast.matchup as { roster_id: number }).roster_id)).toBe(true);
    }
    const wrapped = getDemoWrapped({ roster_id: 1 });
    expect(canonicalIds.has(wrapped.roster_id)).toBe(true);
  });
});

describe("Landlord undefeated / personal hook scope", () => {
  it("Landlord must not show undefeated when canonical data contains losses", () => {
    const data = getDemoLeagueData();
    const expectedGames = data.totalsByManager.find((t) => t.key === LANDLORD_KEY)!.totalGames;
    const card = computePersonalHookCard(
      LANDLORD_KEY,
      data.weeklyMatchups,
      [],
      data.league.season,
      expectedGames,
    );
    expect(card?.type).not.toBe("undefeated");
    const weekly = managerRecordFromWeekly(LANDLORD_KEY, data.weeklyMatchups);
    expect(weekly.losses).toBeGreaterThan(0);
  });

  it("League History total and personal-history record agree on all-time scope", () => {
    const data = getDemoLeagueData();
    const grid = data.totalsByManager.find((t) => t.key === LANDLORD_KEY)!;
    const weekly = managerRecordFromWeekly(LANDLORD_KEY, data.weeklyMatchups);
    const h2h = h2hTotalsForManager(LANDLORD_KEY);
    expect(grid.totalWins).toBe(weekly.wins);
    expect(grid.totalLosses).toBe(weekly.losses);
    expect(h2h.wins).toBe(weekly.wins);
    expect(h2h.losses).toBe(weekly.losses);
  });

  it("genuine undefeated fixture shows concrete record e.g. 7–0 (never ∞)", () => {
    const undefeatedRows = Array.from({ length: 7 }, (_, i) => ({
      season: "2024",
      week: i + 1,
      managerKey: "mgr:perfect",
      opponentKey: "mgr:other",
      points: 120 + i,
      opponentPoints: 100,
      margin: 20,
      won: true,
    }));
    const card = computePersonalHookCard("mgr:perfect", undefeatedRows, [], "2024", 7);
    expect(card?.type).toBe("undefeated");
    if (card?.type === "undefeated") {
      expect(card.record).toBe("7-0");
      expect(card.record).not.toContain("∞");
      expect(card.wins).toBe(7);
      expect(card.losses).toBe(0);
      expect(card.scope).toBe("all_time");
    }
  });

  it("sparse/partial fixture must not produce an all-time undefeated claim", () => {
    const sparse = [
      {
        season: "2024",
        week: 8,
        managerKey: LANDLORD_KEY,
        opponentKey: "mgr:rebuild",
        points: 167.4,
        opponentPoints: 62.1,
        margin: 105.3,
        won: true,
      },
    ];
    const card = computePersonalHookCard(LANDLORD_KEY, sparse, [], "2024", 129);
    expect(card?.type).toBe("undefeated");
    if (card?.type === "undefeated") {
      expect(card.scope).toBe("partial");
      expect(card.record).toBe("1-0");
      expect(card.title.toLowerCase()).toContain("range");
      expect(card.record).not.toContain("∞");
    }
  });

  it("no ∞ wins display string in undefeated card fields", () => {
    const undefeatedRows = Array.from({ length: 3 }, (_, i) => ({
      season: "2024",
      week: i + 1,
      managerKey: "mgr:x",
      opponentKey: "mgr:y",
      points: 110,
      opponentPoints: 90,
      margin: 20,
      won: true,
    }));
    const card = computePersonalHookCard("mgr:x", undefeatedRows, [], "2024", 3);
    const blob = JSON.stringify(card);
    expect(blob).not.toContain("∞");
  });
});

describe("demo season outcomes and Wrapped/Autopsy", () => {
  it("champion/runner-up derive from canonical demo bracket", () => {
    const weekly = getRegularSeasonWeeklyMatchups("2024");
    const standings = DEMO_MANAGERS.map((m) => {
      const rec = managerRecordFromWeekly(m.key, weekly);
      const pf = weekly
        .filter((r) => r.managerKey === m.key)
        .reduce((s, r) => s + r.points, 0);
      return {
        rosterId: m.rosterId,
        wins: rec.wins,
        losses: rec.losses,
        ties: rec.ties,
        pointsFor: pf,
      };
    });
    const outcomes = buildSeasonOutcomes({
      season: "2024",
      rosterIds: DEMO_MANAGERS.map((m) => m.rosterId),
      regularSeasonStandings: standings,
      playoffTeams: 6,
      winnersBracket: DEMO_2024_WINNERS_BRACKET,
      losersBracket: [],
      losersBracketStatus: "available",
    });
    const champ = outcomes.find((o) => o.championshipWon);
    const runner = outcomes.find((o) => o.runnerUp);
    expect(champ?.rosterId).toBe(1); // Landlord
    expect(runner?.rosterId).toBe(2); // Playoff Choker
    // Bracket final: t1=1 t2=2 w=1
    const final = DEMO_2024_WINNERS_BRACKET.find((r) => r.p === 1);
    expect(final?.w).toBe(1);
    expect(final?.l).toBe(2);
  });

  it("demo playoff badges in seasonStats agree with SeasonOutcome", () => {
    const data = getDemoLeagueData();
    const s2024 = data.seasonStats.filter((s) => s.season === "2024");
    const landlord = s2024.find((s) => s.managerKey === LANDLORD_KEY)!;
    const choker = s2024.find((s) => s.managerKey === "mgr:choker")!;
    expect(landlord.championshipWon).toBe(true);
    expect(choker.runnerUp).toBe(true);
    expect(landlord.championshipWon).not.toBe(choker.championshipWon);
  });

  it("Wrapped and Autopsy season-level metrics agree with canonical matchup history", () => {
    const seasonRows = getRegularSeasonWeeklyMatchups("2024");
    const landlordRec = managerRecordFromWeekly(LANDLORD_KEY, seasonRows);
    const wrapped = getDemoWrapped({ roster_id: 1 });
    expect(wrapped.wrapped.season.record).toBe(
      `${landlordRec.wins}-${landlordRec.losses}`,
    );

    const autopsy = getDemoAutopsy();
    const highCard = autopsy.cards.find((c) => c.type === "season_high");
    const maxPts = Math.max(...seasonRows.map((m) => m.points));
    expect(Number(highCard?.meta?.points)).toBe(maxPts);

    const lowCard = autopsy.cards.find((c) => c.type === "season_low");
    const minPts = Math.min(...seasonRows.map((m) => m.points));
    expect(Number(lowCard?.meta?.points)).toBe(minPts);
  });
});

describe("demo matchup classifier shells", () => {
  it("future 0–0 demo shell does not create a winner", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 0, matchup_id: 1 },
      { roster_id: 2, points: 0, matchup_id: 1 },
      { weekIsFinal: true },
    );
    expect(truth.hasWinner).toBe(false);
    expect(truth.isTie).toBe(false);
    expect(truth.hasNoFinalResult).toBe(true);
  });

  it("demo tie does not create a winner", () => {
    const truth = matchupFinalityTruth(
      { roster_id: 1, points: 100.5, matchup_id: 1 },
      { roster_id: 2, points: 100.5, matchup_id: 1 },
      { weekIsFinal: true },
    );
    expect(truth.hasWinner).toBe(false);
    expect(truth.isTie).toBe(true);
  });
});

describe("email omits invented position leaders", () => {
  it("does not include Cash Cons / Underachievers or positionLeaders without fixture", async () => {
    const email = await getDemoWeeklyEmailPayload(DEMO_ICONIC_WEEK);
    expect(email.positionLeaders).toBeUndefined();
    const blob = JSON.stringify(email);
    expect(blob).not.toContain("Cash Cons");
    expect(blob).not.toContain("Underachievers");
  });
});

describe("demo power rankings API inputs", () => {
  it("demo power ranking teams share week scores with roast scoreboard", () => {
    const week = DEMO_ICONIC_WEEK;
    const board = getDemoWeekScoreboard(week);
    const { teams } = getDemoPowerRankingInputs(DEMO_ICONIC_SEASON, week);
    const rankings = generatePowerRankings(teams);
    expect(rankings).toHaveLength(12);
    for (const team of teams) {
      const rid = Number(team.teamId);
      expect(team.weeklyScores?.find((w) => w.week === week)?.score).toBe(
        board.scoresByRosterId[rid],
      );
    }
  });
});
