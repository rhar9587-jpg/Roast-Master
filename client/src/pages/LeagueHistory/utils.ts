import type { Badge } from "./types";

export const BADGES: Badge[] = [
  "OWNED",
  "NEMESIS",
  "RIVAL",
  "EDGE",
  "SMALL SAMPLE",
];

export type RecentLeague = {
  leagueId: string;
  leagueName?: string;
  season?: string;
  startWeek: number;
  endWeek: number;
  timestamp: number;
};

const STORAGE_KEY = "fantasy-roast-recent-leagues";
const VIEWER_STORAGE_KEY = "fantasy-roast-viewerByLeague";
const MAX_RECENT_LEAGUES = 10;

export function getRecentLeagues(): RecentLeague[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as RecentLeague[];
    if (!Array.isArray(parsed)) return [];
    // Sort by timestamp descending (most recent first)
    return parsed.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  } catch {
    return [];
  }
}

export function saveRecentLeague(
  leagueId: string,
  leagueName?: string,
  season?: string,
  startWeek?: number,
  endWeek?: number
): void {
  try {
    const recent = getRecentLeagues();
    // Remove existing entry for this leagueId/startWeek/endWeek combo
    const filtered = recent.filter(
      (r) =>
        !(
          r.leagueId === leagueId &&
          r.startWeek === (startWeek ?? 1) &&
          r.endWeek === (endWeek ?? 17)
        )
    );
    // Add new entry at the beginning
    const newEntry: RecentLeague = {
      leagueId,
      leagueName,
      season,
      startWeek: startWeek ?? 1,
      endWeek: endWeek ?? 17,
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_LEAGUES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    // Silently fail if localStorage quota exceeded or other error
    console.warn("Failed to save recent league:", err);
  }
}

export function getViewerByLeague(leagueId: string): string | null {
  try {
    const stored = localStorage.getItem(VIEWER_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return null;
    const v = parsed[leagueId];
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setViewerByLeague(leagueId: string, viewerKey: string): void {
  try {
    const stored = localStorage.getItem(VIEWER_STORAGE_KEY);
    const parsed: Record<string, string> = stored
      ? (JSON.parse(stored) as Record<string, string>)
      : {};
    if (!parsed || typeof parsed !== "object") return;
    if (viewerKey) {
      parsed[leagueId] = viewerKey;
    } else {
      delete parsed[leagueId];
    }
    localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(parsed));
  } catch (err) {
    console.warn("Failed to save viewer by league:", err);
  }
}

/** Display name for badges. SMALL SAMPLE → "TOO CLOSE TO CALL" */
export function getBadgeDisplayName(badge: Badge): string {
  return badge === "SMALL SAMPLE" ? "TOO CLOSE TO CALL" : badge;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function scoreToBg(score: number, games: number): string {
  if (games < 4) return "bg-slate-100/30 dark:bg-slate-800/20";

  const s = clamp(score, -1, 1);
  const abs = Math.abs(s);
  const tier =
    abs >= 0.75 ? 5 : abs >= 0.55 ? 4 : abs >= 0.35 ? 3 : abs >= 0.15 ? 2 : 1;

  if (s > 0) {
    const colors = [
      "bg-emerald-100",
      "bg-emerald-200",
      "bg-emerald-300",
      "bg-emerald-400",
      "bg-emerald-500",
    ];
    const shadows = abs >= 0.50 ? " shadow-sm shadow-emerald-200/50" : "";
    return colors[tier - 1] + shadows;
  }
  if (s < 0) {
    const colors = [
      "bg-rose-100",
      "bg-rose-200",
      "bg-rose-300",
      "bg-rose-400",
      "bg-rose-500",
    ];
    const shadows = abs >= 0.50 ? " shadow-sm shadow-rose-200/50" : "";
    return colors[tier - 1] + shadows;
  }
  return "bg-muted/20";
}

export function badgePill(badge: Badge): string {
  switch (badge) {
    case "OWNED":
      return "bg-emerald-600 text-white text-[11px] font-semibold rounded-md px-2 py-0.5 shadow-sm";
    case "NEMESIS":
      return "bg-rose-600 text-white text-[11px] font-semibold rounded-md px-2 py-0.5 shadow-sm";
    case "RIVAL":
      return "bg-amber-500 text-white text-[11px] font-semibold rounded-md px-2 py-0.5";
    case "SMALL SAMPLE":
      return "bg-slate-400/40 text-slate-700 dark:text-slate-300 text-[9px] rounded-md px-1 py-0.5";
    default:
      return "bg-muted-foreground/20 text-foreground text-[11px] rounded-md px-2 py-0.5";
  }
}

export function abbrev(name: string): string {
  if (!name) return "???";
  const first = name.split(" ")[0] ?? name;
  return first.length > 10 ? first.slice(0, 10) + "…" : first;
}

export function fmtRecord(w: number, l: number, t: number): string {
  return t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`;
}

export function fmtScore(s: number): string {
  return `${s >= 0 ? "+" : ""}${s.toFixed(2)}`;
}
