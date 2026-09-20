/**
 * Canonical week-scoped team state reconstructed from matchups only.
 * Never reads roster.settings wins / losses / points-against.
 */

import {
  classifyMatchupGroup,
  isPlayableClassification,
  type MatchupClassification,
} from "./matchupStatus";

export type RosterIdentity = {
  rosterId: number;
  ownerId: string | null;
  displayName: string;
};

export type TeamStateThroughWeek = {
  teamId: string;
  rosterId: number;
  ownerKey: string;
  displayName: string;
  throughWeek: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Explicit week identity → points scored that week (played games only). */
  weeklyScores: Map<number, number>;
};

export type RawWeekMatchup = {
  matchup_id: number;
  roster_id: number;
  points: unknown;
};

export function ownerKeyFor(ownerId: string | null | undefined, rosterId: number): string {
  if (ownerId) return `owner:${ownerId}`;
  return `roster:${rosterId}`;
}

function emptyState(identity: RosterIdentity, throughWeek: number): TeamStateThroughWeek {
  return {
    teamId: String(identity.rosterId),
    rosterId: identity.rosterId,
    ownerKey: ownerKeyFor(identity.ownerId, identity.rosterId),
    displayName: identity.displayName,
    throughWeek,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    weeklyScores: new Map(),
  };
}

function applyPlayedGame(
  state: TeamStateThroughWeek,
  week: number,
  myPoints: number,
  oppPoints: number,
  result: "W" | "L" | "T",
): void {
  state.pointsFor += myPoints;
  state.pointsAgainst += oppPoints;
  state.weeklyScores.set(week, myPoints);
  if (result === "W") state.wins += 1;
  else if (result === "L") state.losses += 1;
  else state.ties += 1;
}

function applyClassification(
  byRoster: Map<number, TeamStateThroughWeek>,
  week: number,
  classification: MatchupClassification,
): void {
  if (!isPlayableClassification(classification)) return;

  if (classification.status === "tie") {
    const { a, b } = classification;
    const stateA = byRoster.get(a.rosterId);
    const stateB = byRoster.get(b.rosterId);
    // Missing roster row: skip that side; do not invent teams from matchups alone.
    if (stateA) applyPlayedGame(stateA, week, a.points, b.points, "T");
    if (stateB) applyPlayedGame(stateB, week, b.points, a.points, "T");
    return;
  }

  const { winner, loser } = classification;
  const winState = byRoster.get(winner.rosterId);
  const loseState = byRoster.get(loser.rosterId);
  if (winState) applyPlayedGame(winState, week, winner.points, loser.points, "W");
  if (loseState) applyPlayedGame(loseState, week, loser.points, winner.points, "L");
}

/**
 * Reconstruct standings through `throughWeek` from matchup rows only.
 * Weeks absent from `matchupsByWeek` are skipped (no positional shift).
 * Scheduled 0–0 shells and malformed pairs do not affect W/L/PF/PA/scores.
 */
export function buildTeamStatesThroughWeek(params: {
  throughWeek: number;
  identities: RosterIdentity[];
  matchupsByWeek: Map<number, RawWeekMatchup[]> | Record<number, RawWeekMatchup[]>;
}): TeamStateThroughWeek[] {
  const throughWeek = Math.max(0, Math.floor(params.throughWeek));
  const byRoster = new Map<number, TeamStateThroughWeek>();
  for (const identity of params.identities) {
    byRoster.set(identity.rosterId, emptyState(identity, throughWeek));
  }

  const asMap =
    params.matchupsByWeek instanceof Map
      ? params.matchupsByWeek
      : new Map(
          Object.entries(params.matchupsByWeek).map(([k, v]) => [Number(k), v] as const),
        );

  for (let week = 1; week <= throughWeek; week++) {
    const rows = asMap.get(week);
    if (!rows?.length) continue;

    const byMatchupId = new Map<number, RawWeekMatchup[]>();
    for (const row of rows) {
      if (row.matchup_id == null) continue;
      const list = byMatchupId.get(row.matchup_id) ?? [];
      list.push(row);
      byMatchupId.set(row.matchup_id, list);
    }

    for (const group of Array.from(byMatchupId.values())) {
      const classification = classifyMatchupGroup(group);
      applyClassification(byRoster, week, classification);
    }
  }

  return params.identities.map((id) => byRoster.get(id.rosterId)!);
}

export function formatTeamRecord(wins: number, losses: number, ties: number): string {
  if (ties > 0) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

/** Convert team state into ordered week-keyed score entries for power rankings. */
export function weekKeyedScoresFromState(
  state: TeamStateThroughWeek,
): Array<{ week: number; score: number }> {
  return Array.from(state.weeklyScores.entries())
    .map(([week, score]) => ({ week, score }))
    .sort((a, b) => a.week - b.week);
}
