import type { Badge } from "./types";

export const BADGES: Badge[] = [
  "OWNED",
  "NEMESIS",
  "RIVAL",
  "EDGE",
  "SMALL SAMPLE",
];

/** Display name for badges. SMALL SAMPLE → "TOO CLOSE TO CALL" */
export function getBadgeDisplayName(badge: Badge): string {
  return badge === "SMALL SAMPLE" ? "TOO CLOSE TO CALL" : badge;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function scoreToBg(score: number, games: number): string {
  if (games < 3) return "bg-slate-200/60 dark:bg-slate-700/40";

  const s = clamp(score, -1, 1);
  const abs = Math.abs(s);
  const tier =
    abs >= 0.75 ? 5 : abs >= 0.55 ? 4 : abs >= 0.35 ? 3 : abs >= 0.15 ? 2 : 1;

  if (s > 0) {
    return [
      "bg-emerald-50",
      "bg-emerald-100",
      "bg-emerald-200",
      "bg-emerald-300",
      "bg-emerald-400",
    ][tier - 1];
  }
  if (s < 0) {
    return [
      "bg-rose-50",
      "bg-rose-100",
      "bg-rose-200",
      "bg-rose-300",
      "bg-rose-400",
    ][tier - 1];
  }
  return "bg-muted";
}

export function badgePill(badge: Badge): string {
  switch (badge) {
    case "OWNED":
      return "bg-emerald-600 text-white";
    case "NEMESIS":
      return "bg-rose-600 text-white";
    case "RIVAL":
      return "bg-amber-500 text-white";
    case "SMALL SAMPLE":
      return "bg-slate-600 text-white";
    default:
      return "bg-muted-foreground/15 text-foreground";
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
