/**
 * Public weekly recap share URL helpers (client + server).
 * Canonical path: /share/league/:leagueId/week/:week
 */

import { SITE_URL } from "./site";

export function clampShareWeek(week: number): number {
  const n = Math.floor(Number(week));
  if (!Number.isFinite(n)) return 1;
  return Math.min(18, Math.max(1, n));
}

/** Relative path for the public weekly share page. */
export function weeklyPublicSharePath(leagueId: string, week: number): string {
  const id = encodeURIComponent(String(leagueId || "").trim());
  const w = clampShareWeek(week);
  return `/share/league/${id}/week/${w}`;
}

/** Absolute public share URL (defaults to canonical production origin). */
export function weeklyPublicShareUrl(
  leagueId: string,
  week: number,
  origin: string = SITE_URL,
): string {
  const base = String(origin || SITE_URL).replace(/\/$/, "");
  return `${base}${weeklyPublicSharePath(leagueId, week)}`;
}

/** Absolute OG image URL for a weekly share page. */
export function weeklyPublicShareOgImageUrl(
  leagueId: string,
  week: number,
  origin: string = SITE_URL,
): string {
  return `${weeklyPublicShareUrl(leagueId, week, origin)}/og.png`;
}

/** App deep-link to open this league in Weekly (not the public share page). */
export function weeklyLeagueAppPath(
  leagueId: string,
  options?: { week?: number },
): string {
  const params = new URLSearchParams();
  params.set("league_id", String(leagueId || "").trim());
  params.set("tab", "weekly");
  if (options?.week != null && Number.isFinite(options.week)) {
    params.set("week", String(clampShareWeek(options.week)));
  }
  return `/league-history/dominance?${params.toString()}`;
}

export function weeklyLeagueAppUrl(
  leagueId: string,
  origin: string = SITE_URL,
  options?: { week?: number },
): string {
  const base = String(origin || SITE_URL).replace(/\/$/, "");
  return `${base}${weeklyLeagueAppPath(leagueId, options)}`;
}

/** Landing CTA: username-entry / get-started flow on the marketing home. */
export function roastMyLeagueUrl(origin: string = SITE_URL): string {
  const base = String(origin || SITE_URL).replace(/\/$/, "") || SITE_URL;
  return `${base}/#get-started`;
}
