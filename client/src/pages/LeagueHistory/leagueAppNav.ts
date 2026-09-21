/**
 * League app navigation — Weekly-as-default paths and URL state.
 * Keeps routing explicit (query params) so refresh/deep-links stay debuggable.
 */

import { clampWeek, type WeeklyEmailMode } from "./weeklyContext";

export type LeagueAppTab = "weekly" | "history" | "season" | "end";

export const DEFAULT_LEAGUE_TAB: LeagueAppTab = "weekly";

const TAB_SET = new Set<string>(["weekly", "history", "season", "end"]);

export function parseLeagueAppTab(raw: string | null | undefined): LeagueAppTab | null {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (!TAB_SET.has(t)) return null;
  return t as LeagueAppTab;
}

export function parseWeeklyEmailModeParam(
  raw: string | null | undefined,
): WeeklyEmailMode | null {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (t === "recap" || t === "preview") return t;
  return null;
}

/** Reject empty / obviously broken stored ids without inventing validity rules. */
export function isPlausibleLeagueId(leagueId: string | null | undefined): boolean {
  const id = String(leagueId || "").trim();
  if (!id) return false;
  if (id.length < 3 || id.length > 80) return false;
  // Allow demo ids and numeric Sleeper ids
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export type LeagueAppPathOptions = {
  leagueId: string;
  tab?: LeagueAppTab;
  week?: number;
  emailMode?: WeeklyEmailMode;
  startWeek?: number;
  endWeek?: number;
  /** Viewer manager key (existing `view` query param). */
  viewer?: string;
};

/** Build `/league-history/dominance?...` with Weekly as the default tab. */
export function buildLeagueAppPath(opts: LeagueAppPathOptions): string {
  const leagueId = String(opts.leagueId || "").trim();
  const params = new URLSearchParams();
  if (leagueId) params.set("league_id", leagueId);
  const tab = opts.tab ?? DEFAULT_LEAGUE_TAB;
  params.set("tab", tab);
  if (tab === "weekly") {
    if (opts.week != null && Number.isFinite(opts.week)) {
      params.set("week", String(clampWeek(opts.week)));
    }
    if (opts.emailMode) params.set("email_mode", opts.emailMode);
  }
  params.set("start_week", String(Math.max(1, Math.floor(Number(opts.startWeek) || 1))));
  params.set("end_week", String(Math.max(1, Math.floor(Number(opts.endWeek) || 17))));
  if (opts.viewer?.trim()) params.set("view", opts.viewer.trim());
  return `/league-history/dominance?${params.toString()}`;
}

export type ParsedLeagueAppSearch = {
  leagueId: string | null;
  tab: LeagueAppTab | null;
  week: number | null;
  emailMode: WeeklyEmailMode | null;
  startWeek: number | null;
  endWeek: number | null;
  viewer: string | null;
};

export function parseLeagueAppSearch(
  search: string | URLSearchParams,
): ParsedLeagueAppSearch {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const leagueIdRaw = params.get("league_id");
  const weekRaw = params.get("week");
  const weekNum = weekRaw != null ? Number(weekRaw) : NaN;
  const startRaw = params.get("start_week");
  const endRaw = params.get("end_week");
  const startNum = startRaw != null ? Number(startRaw) : NaN;
  const endNum = endRaw != null ? Number(endRaw) : NaN;
  return {
    leagueId: leagueIdRaw?.trim() || null,
    tab: parseLeagueAppTab(params.get("tab")),
    week:
      Number.isFinite(weekNum) && weekNum >= 1 ? clampWeek(weekNum) : null,
    emailMode: parseWeeklyEmailModeParam(params.get("email_mode")),
    startWeek: Number.isFinite(startNum) && startNum >= 1 ? Math.floor(startNum) : null,
    endWeek: Number.isFinite(endNum) && endNum >= 1 ? Math.floor(endNum) : null,
    viewer: params.get("view")?.trim() || null,
  };
}

export function resumeContinueTitle(leagueName?: string | null): string {
  const name = String(leagueName || "").trim();
  return name ? `Continue ${name}` : "Continue your league";
}

export function resumeSupportingLine(opts: {
  lastWeek?: number | null;
  latestFinalWeek?: number | null;
}): string {
  const latest = Math.max(0, Math.floor(Number(opts.latestFinalWeek) || 0));
  const last = Math.max(0, Math.floor(Number(opts.lastWeek) || 0));
  if (latest >= 1) return `Latest recap available · Week ${latest}`;
  if (last >= 1) return `Week ${last}`;
  return "Open this week's roast";
}

/** Pick a resume target from recent leagues; skip stale/invalid ids. */
export function pickResumeLeague<T extends { leagueId: string }>(
  recent: T[],
): T | null {
  for (const entry of recent) {
    if (isPlausibleLeagueId(entry.leagueId)) return entry;
  }
  return null;
}
