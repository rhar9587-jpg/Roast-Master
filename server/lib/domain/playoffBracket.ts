/**
 * Sleeper winners/losers bracket resolution.
 *
 * Bracket rows use terse keys (r/m/t1/t2/w/l/p). Placement matchups carry `p`:
 * the winner earns finish `p`, the loser earns `p + 1`.
 *
 * Never invents winners from unresolved rows (w/l null).
 */

export type SleeperBracketFrom = { w?: number; l?: number };

export type SleeperBracketRow = {
  r?: number;
  m?: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  /** Place the winner is playing for (1 = championship). */
  p?: number | null;
  t1_from?: SleeperBracketFrom;
  t2_from?: SleeperBracketFrom;
};

export type BracketResolution = {
  /** Roster IDs that appear in the winners bracket (qualified). */
  playoffRosterIds: Set<number>;
  /** finalFinish by roster_id when determinable from placement rows. */
  finalFinishByRosterId: Map<number, number>;
  championRosterId?: number;
  runnerUpRosterId?: number;
  /** True only when the championship matchup (p=1 or inferred finals) has w+l. */
  championshipResolved: boolean;
  /** Last place from losers/consolation bracket when determinable. */
  lastPlaceRosterId?: number;
  /** True when a consolation/toilet-bowl placement determined last place. */
  lastPlaceFromConsolation: boolean;
};

function isRosterId(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Collect roster IDs present on a row (slots or decided w/l). */
function rosterIdsOnRow(row: SleeperBracketRow): number[] {
  const out: number[] = [];
  if (isRosterId(row.t1)) out.push(row.t1);
  if (isRosterId(row.t2)) out.push(row.t2);
  if (isRosterId(row.w)) out.push(row.w);
  if (isRosterId(row.l)) out.push(row.l);
  return out;
}

function isCompletedPlacement(row: SleeperBracketRow): boolean {
  return isRosterId(row.w) && isRosterId(row.l) && row.w !== row.l;
}

/**
 * Bye / incomplete-side advance: one roster present, opponent missing, winner equals the roster.
 * Counts as a resolved advance but does not assign a placement finish by itself.
 */
export function isResolvedBye(row: SleeperBracketRow): boolean {
  const t1Ok = isRosterId(row.t1);
  const t2Ok = isRosterId(row.t2);
  if (t1Ok && t2Ok) return false;
  if (!isRosterId(row.w)) return false;
  if (t1Ok && !t2Ok) return row.w === row.t1;
  if (t2Ok && !t1Ok) return row.w === row.t2;
  return false;
}

function applyPlacement(
  finishes: Map<number, number>,
  row: SleeperBracketRow,
): void {
  if (!isCompletedPlacement(row)) return;
  if (typeof row.p !== "number" || !Number.isFinite(row.p) || row.p < 1) return;
  finishes.set(row.w!, row.p);
  finishes.set(row.l!, row.p + 1);
}

/**
 * Find championship matchup: prefer explicit p === 1; else highest-round completed
 * two-team winners-bracket game that is not a lower placement (p > 1).
 * Never treat a round-1 game as the championship when later rounds exist.
 */
function findChampionshipRow(winners: SleeperBracketRow[]): SleeperBracketRow | null {
  const valid = winners.filter((row) => row != null && typeof row === "object");
  const withP1 = valid.filter(
    (row) => row.p === 1 && (isCompletedPlacement(row) || isRosterId(row.w) || isRosterId(row.l)),
  );
  if (withP1.length) {
    return withP1.find((r) => isCompletedPlacement(r)) ?? withP1[0]!;
  }

  const maxRoundInBracket = valid.reduce((max, row) => Math.max(max, Number(row.r ?? 0)), 0);
  const completed = valid.filter(
    (row) => isCompletedPlacement(row) && (row.p == null || row.p === 1),
  );
  if (!completed.length) return null;

  let best = completed[0]!;
  for (const row of completed) {
    const br = Number(best.r ?? 0);
    const rr = Number(row.r ?? 0);
    if (rr > br) best = row;
  }
  const maxR = Number(best.r ?? 0);
  // Require the true final round of the bracket (not an early completed matchup)
  if (maxR < maxRoundInBracket) return null;
  if (maxRoundInBracket >= 2 && maxR < 2) return null;
  const atMax = completed.filter((r) => Number(r.r ?? 0) === maxR);
  if (atMax.length !== 1) return null;
  return best;
}

/**
 * Resolve winners + losers brackets into placements without inventing unresolved results.
 */
export function resolvePlayoffBrackets(
  winnersBracket: SleeperBracketRow[] | null | undefined,
  losersBracket: SleeperBracketRow[] | null | undefined = [],
): BracketResolution {
  const winners = Array.isArray(winnersBracket) ? winnersBracket : [];
  const losers = Array.isArray(losersBracket) ? losersBracket : [];

  const playoffRosterIds = new Set<number>();
  for (const row of winners) {
    if (row == null || typeof row !== "object") continue;
    if (row.m == null || !Number.isFinite(Number(row.m))) continue;
    for (const id of rosterIdsOnRow(row)) playoffRosterIds.add(id);
  }

  const finalFinishByRosterId = new Map<number, number>();

  for (const row of winners) {
    if (row == null || typeof row !== "object") continue;
    applyPlacement(finalFinishByRosterId, row);
  }
  for (const row of losers) {
    if (row == null || typeof row !== "object") continue;
    applyPlacement(finalFinishByRosterId, row);
  }

  const championshipRow = findChampionshipRow(winners);
  let championRosterId: number | undefined;
  let runnerUpRosterId: number | undefined;
  let championshipResolved = false;

  if (championshipRow && isCompletedPlacement(championshipRow)) {
    championRosterId = championshipRow.w!;
    runnerUpRosterId = championshipRow.l!;
    championshipResolved = true;
    // Ensure finishes even if p was missing on inferred championship
    if (!finalFinishByRosterId.has(championRosterId)) finalFinishByRosterId.set(championRosterId, 1);
    if (!finalFinishByRosterId.has(runnerUpRosterId)) finalFinishByRosterId.set(runnerUpRosterId, 2);
  }

  // Last place: among losers-bracket placements, highest finish number (worst place).
  let lastPlaceRosterId: number | undefined;
  let lastPlaceFromConsolation = false;
  if (losers.length > 0) {
    let worstFinish = -Infinity;
    for (const row of losers) {
      if (!isCompletedPlacement(row)) continue;
      if (typeof row.p !== "number" || !Number.isFinite(row.p)) continue;
      const loserFinish = row.p + 1;
      if (loserFinish > worstFinish) {
        worstFinish = loserFinish;
        lastPlaceRosterId = row.l!;
        lastPlaceFromConsolation = true;
      }
    }
    // Also consider any finish map entries that originated from losers rows
    if (lastPlaceRosterId == null) {
      for (const [rosterId, finish] of finalFinishByRosterId) {
        // Only candidates who appear in losers bracket
        const inLosers = losers.some((row) => rosterIdsOnRow(row).includes(rosterId));
        if (!inLosers) continue;
        if (finish > worstFinish) {
          worstFinish = finish;
          lastPlaceRosterId = rosterId;
          lastPlaceFromConsolation = true;
        }
      }
    }
  }

  return {
    playoffRosterIds,
    finalFinishByRosterId,
    championRosterId,
    runnerUpRosterId,
    championshipResolved,
    lastPlaceRosterId,
    lastPlaceFromConsolation,
  };
}
