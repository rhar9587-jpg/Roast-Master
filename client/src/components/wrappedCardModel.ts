/**
 * Pure layout helpers for WrappedCard share posters.
 * Keep variant/formatting logic testable without a DOM.
 */

export const SHARE_CARD_WIDTH = 540;
/** 4:5 portrait ratio — Instagram feed / story-friendly. */
export const SHARE_CARD_HEIGHT = 675;
export const SHARE_CARD_ASPECT = `${SHARE_CARD_WIDTH} / ${SHARE_CARD_HEIGHT}`;

export type WrappedAccent = "green" | "pink" | "blue" | "orange" | "slate";
export type WrappedVariant = "hero" | "matchup" | "verdict";

export type MatchupData = {
  teamA: string;
  scoreA: number;
  teamB: string;
  scoreB: number;
  margin?: number;
};

export type ResolveVariantInput = {
  isMatchup?: boolean;
  matchupData?: MatchupData | null;
  bigValue?: string | null;
};

export function resolveWrappedVariant(input: ResolveVariantInput): WrappedVariant {
  if (input.isMatchup && input.matchupData) return "matchup";
  const v = (input.bigValue ?? "").trim();
  if (v && v !== "—" && v !== "-" && v !== "–") return "hero";
  return "verdict";
}

/** Clamp display copy for poster layouts (no paragraph dump). */
export function clampPosterText(text: string | undefined | null, max: number): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * Format a manager/team name for a large poster headline.
 * Long names shrink via CSS; this only hard-truncates extreme length.
 */
export function formatPosterName(name: string | undefined | null, max = 28): string {
  const t = (name ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "UNKNOWN";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function formatScore(n: number, digits = 1): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(digits);
}

export function computeMatchupMargin(data: MatchupData): number {
  if (typeof data.margin === "number" && Number.isFinite(data.margin)) {
    return Math.abs(data.margin);
  }
  return Math.abs(Number(data.scoreA) - Number(data.scoreB));
}

export function formatMargin(data: MatchupData, digits = 1): string {
  return `+${formatScore(computeMatchupMargin(data), digits)}`;
}

export type AccentTheme = {
  id: WrappedAccent;
  /** Base poster fill */
  bg: string;
  /** Secondary gradient stop */
  bgAlt: string;
  /** Accent glow / bar */
  glow: string;
  /** Highlight for scores / margin */
  highlight: string;
  /** Soft shape fill */
  shape: string;
  /** Kicker text */
  kicker: string;
};

export const ACCENT_THEMES: Record<WrappedAccent, AccentTheme> = {
  green: {
    id: "green",
    bg: "#07140c",
    bgAlt: "#0f2a18",
    glow: "#34d399",
    highlight: "#a3e635",
    shape: "rgba(52, 211, 153, 0.18)",
    kicker: "#86efac",
  },
  pink: {
    id: "pink",
    bg: "#14060c",
    bgAlt: "#2a0a16",
    glow: "#fb7185",
    highlight: "#fb7185",
    shape: "rgba(251, 113, 133, 0.20)",
    kicker: "#fda4af",
  },
  blue: {
    id: "blue",
    bg: "#060b16",
    bgAlt: "#0b1c33",
    glow: "#38bdf8",
    highlight: "#7dd3fc",
    shape: "rgba(56, 189, 248, 0.18)",
    kicker: "#7dd3fc",
  },
  orange: {
    id: "orange",
    bg: "#140a04",
    bgAlt: "#2a1406",
    glow: "#fb923c",
    highlight: "#fdba74",
    shape: "rgba(251, 146, 60, 0.20)",
    kicker: "#fdba74",
  },
  slate: {
    id: "slate",
    bg: "#0b0d14",
    bgAlt: "#171b26",
    glow: "#94a3b8",
    highlight: "#e2e8f0",
    shape: "rgba(148, 163, 184, 0.16)",
    kicker: "#cbd5e1",
  },
};

export function getAccentTheme(accent: WrappedAccent = "green"): AccentTheme {
  return ACCENT_THEMES[accent] ?? ACCENT_THEMES.green;
}
