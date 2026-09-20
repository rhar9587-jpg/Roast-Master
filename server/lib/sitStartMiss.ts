/**
 * Shared sit/start helpers for weekly roast + commissioner email.
 * Never suggest illegal swaps (e.g. WR for QB).
 */

import { displayNameFromSleeperPlayer } from "./playerDisplayName";

export type PlayerPosLite = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
};

/** Same position, or flex-eligible (RB/WR/TE) swaps only. */
export function canFantasyReplace(benchPos?: string | null, starterPos?: string | null): boolean {
  const b = String(benchPos || "").toUpperCase();
  const s = String(starterPos || "").toUpperCase();
  if (!b || !s) return false;
  if (b === s) return true;
  const FLEX = new Set(["RB", "WR", "TE"]);
  return FLEX.has(b) && FLEX.has(s);
}

export type SitStartMiss = {
  benchPid: string;
  starterPid: string;
  benchPts: number;
  starterPts: number;
  sitStartMiss: string;
};

/**
 * Best legal sit/start miss: highest-scoring bench player who outscored a compatible starter.
 */
export function findBestSitStartMiss(
  row: {
    players?: string[];
    starters?: (string | null)[];
    players_points?: Record<string, number>;
    starters_points?: Record<string, number>;
  },
  playersById: Record<string, PlayerPosLite> | null | undefined,
): SitStartMiss | null {
  if (!row.players?.length || !row.starters?.length) return null;
  const pts = row.players_points || row.starters_points || {};
  const starters = (row.starters || []).filter(Boolean) as string[];
  const starterSet = new Set(starters);

  const bench = row.players
    .filter((pid) => !starterSet.has(pid))
    .map((pid) => ({
      pid,
      pts: Number(pts[pid]) || 0,
      pos: playersById?.[pid]?.position,
    }))
    .filter((x) => x.pts > 0);

  const starterRows = starters
    .map((pid) => ({
      pid,
      pts: Number(pts[pid]) || 0,
      pos: playersById?.[pid]?.position,
    }))
    .filter((x) => Number.isFinite(x.pts));

  let best: SitStartMiss | null = null;
  for (const b of bench) {
    for (const s of starterRows) {
      if (!canFantasyReplace(b.pos, s.pos)) continue;
      const edge = b.pts - s.pts;
      if (edge <= 0.05) continue;
      if (!best || edge > best.benchPts - best.starterPts) {
        const benchName = displayNameFromSleeperPlayer(playersById?.[b.pid]);
        const starterName = displayNameFromSleeperPlayer(playersById?.[s.pid]);
        // Prefer omission over raw IDs when names are unresolved.
        if (!benchName || !starterName) continue;
        const bPos = b.pos ? ` (${String(b.pos).toUpperCase()})` : "";
        const sPos = s.pos ? ` (${String(s.pos).toUpperCase()})` : "";
        best = {
          benchPid: b.pid,
          starterPid: s.pid,
          benchPts: b.pts,
          starterPts: s.pts,
          sitStartMiss: `${benchName}${bPos} should have started over ${starterName}${sPos}.`,
        };
      }
    }
  }
  return best;
}
