import type { LandlordSummary, ManagerRow } from "./types";

type RivalryHint = {
  aKey: string;
  bKey: string;
} | null;

type MostOwnedHint = {
  victimKey: string;
} | null;

/**
 * Pick a manager that maximizes a cold-user "personal receipt" aha:
 * favorite victim of the landlord → biggest victim → rivalry participant → first roster.
 */
export function suggestViewerKey(
  managers: ManagerRow[],
  landlord: LandlordSummary | null,
  mostOwned: MostOwnedHint,
  biggestRivalry: RivalryHint,
): string | null {
  if (!managers.length) return null;
  const keys = new Set(managers.map((m) => m.key));

  const bestVictim = landlord?.bestVictim?.victimKey;
  if (bestVictim && keys.has(bestVictim)) return bestVictim;

  if (mostOwned?.victimKey && keys.has(mostOwned.victimKey)) {
    return mostOwned.victimKey;
  }

  if (biggestRivalry) {
    if (keys.has(biggestRivalry.aKey)) return biggestRivalry.aKey;
    if (keys.has(biggestRivalry.bKey)) return biggestRivalry.bKey;
  }

  return managers[0]?.key ?? null;
}
