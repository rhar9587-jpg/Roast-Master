import type { Card, RoastResponse } from "@shared/schema";

export type VisualShareCard = {
  kicker: string;
  title: string;
  subtitle?: string;
  bigValue?: string;
  statLabel?: string;
  tagline?: string;
  accent: "green" | "pink" | "blue" | "orange" | "slate";
  isMatchup?: boolean;
  matchupData?: {
    teamA: string;
    scoreA: number;
    teamB: string;
    scoreB: number;
    margin?: number;
  };
};

function safeNum(n: number | undefined | null, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function shortPunchline(text: string | undefined, fallback: string, max = 90): string {
  const t = (text ?? "").trim();
  if (!t) return fallback;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function metaNum(meta: Record<string, unknown> | undefined, key: string): number | null {
  if (!meta) return null;
  const v = meta[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function metaStr(meta: Record<string, unknown> | undefined, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function accentForEngineCard(type: string): VisualShareCard["accent"] {
  const t = type.toLowerCase();
  if (t.includes("top_dog") || t.includes("group_chat")) return "green";
  if (t.includes("embarrassment") || t.includes("blowout") || t.includes("lowest")) return "pink";
  if (t.includes("fraud")) return "orange";
  if (t.includes("worst_coach") || t.includes("coaching") || t.includes("bench")) return "blue";
  if (t.includes("carry")) return "slate";
  return "green";
}

/** Map one engine card → one visual idea (broadcast / meme share graphic). */
export function mapEngineCardToVisual(
  card: Card,
  week: number,
  data: Pick<RoastResponse, "stats">,
): VisualShareCard {
  const type = card.type.toLowerCase();
  const meta = (card.meta && typeof card.meta === "object" ? card.meta : {}) as Record<
    string,
    unknown
  >;
  const weekKicker = `WEEK ${week}`;

  if (type.includes("top_dog")) {
    const name =
      metaStr(meta, "username") ||
      data.stats.highestScorer.username ||
      card.title;
    const score =
      metaNum(meta, "score") ??
      (card.stat ? Number(String(card.stat).replace(/[^\d.-]/g, "")) : null) ??
      data.stats.highestScorer.score;
    return {
      kicker: "TOP DOG",
      title: name.toUpperCase(),
      subtitle: `Highest score of Week ${week}`,
      bigValue: `${safeNum(score).toFixed(1)}`,
      statLabel: "Points",
      tagline: shortPunchline(card.tagline, "Unreal scenes."),
      accent: "green",
    };
  }

  if (type.includes("embarrassment") || type.includes("blowout")) {
    const winnerScore = metaNum(meta, "winner_score");
    const loserScore = metaNum(meta, "loser_score");
    const margin = metaNum(meta, "margin");
    const teamA =
      metaStr(meta, "winner_name") ||
      metaStr(meta, "teamA") ||
      "Winner";
    const teamB =
      metaStr(meta, "loser_name") ||
      metaStr(meta, "teamB") ||
      "Loser";
    if (winnerScore != null && loserScore != null) {
      const resolvedMargin = margin ?? winnerScore - loserScore;
      return {
        kicker: weekKicker,
        title: "MURDER SCENE",
        isMatchup: true,
        matchupData: {
          teamA,
          scoreA: winnerScore,
          teamB,
          scoreB: loserScore,
          margin: resolvedMargin,
        },
        bigValue: `+${safeNum(resolvedMargin).toFixed(1)}`,
        statLabel: "Margin",
        tagline: shortPunchline(card.tagline, "Not competitive."),
        accent: "pink",
      };
    }
    return {
      kicker: weekKicker,
      title: "MURDER SCENE",
      subtitle: shortPunchline(card.subtitle, "Biggest blowout of the week.", 120),
      bigValue: card.stat ?? (margin != null ? `+${margin.toFixed(1)}` : undefined),
      statLabel: "Margin",
      tagline: shortPunchline(card.tagline, "Not competitive."),
      accent: "pink",
    };
  }

  if (type.includes("fraud")) {
    const kind = metaStr(meta, "kind");
    const headline =
      kind === "lucky_win"
        ? "WON LIGHT"
        : kind === "strong_loss"
          ? "ROBBED"
          : shortPunchline(card.title, "FRAUD WATCH", 24).toUpperCase();
    return {
      kicker: "FRAUD WATCH",
      title: headline,
      subtitle: shortPunchline(card.subtitle, "Results don't match the vibes.", 100),
      bigValue: undefined,
      tagline: shortPunchline(card.tagline, "Receipts attached."),
      accent: "orange",
    };
  }

  if (type.includes("worst_coach") || type.includes("bench") || type.includes("coaching")) {
    return {
      kicker: "BENCH CRIMES",
      title: shortPunchline(card.title, "LEFT ON BENCH", 48).toUpperCase(),
      subtitle: shortPunchline(card.subtitle, `Points left on the bench in Week ${week}.`, 110),
      bigValue: card.stat,
      statLabel: "Bench",
      tagline: shortPunchline(card.tagline, "Start your studs."),
      accent: "blue",
    };
  }

  if (type.includes("carry")) {
    return {
      kicker: "CARRY JOB",
      title: shortPunchline(card.title, "ONE MAN ARMY", 40).toUpperCase(),
      subtitle: shortPunchline(card.subtitle, "One player did the heavy lifting.", 110),
      bigValue: card.stat,
      statLabel: "Share",
      tagline: shortPunchline(card.tagline, "Everyone else was scenery."),
      accent: "slate",
    };
  }

  if (type.includes("lowest") || (card.title ?? "").toLowerCase().includes("jail")) {
    const name = metaStr(meta, "username") || data.stats.lowestScorer.username;
    const score = metaNum(meta, "score") ?? data.stats.lowestScorer.score;
    return {
      kicker: "STRAIGHT TO JAIL",
      title: name.toUpperCase(),
      subtitle: `Lowest score of Week ${week}`,
      bigValue: `${safeNum(score).toFixed(1)}`,
      statLabel: "Points",
      tagline: shortPunchline(card.tagline, "Rough night."),
      accent: "pink",
    };
  }

  return {
    kicker: (card.title || "ROAST").toUpperCase().slice(0, 28),
    title: shortPunchline(card.subtitle || card.title, "League moment", 48).toUpperCase(),
    subtitle: weekKicker,
    bigValue: card.stat,
    tagline: shortPunchline(card.tagline, "Send it to the group chat."),
    accent: accentForEngineCard(card.type),
  };
}
