import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingDown, Swords, Users, Zap, Skull, Copy, Check } from "lucide-react";
import type { Card, RoastResponse } from "@shared/schema";
import type { WrappedCardProps } from "@/components/WrappedCard";
import { WrappedCard } from "@/components/WrappedCard";
import { Button } from "@/components/ui/button";

type Accent = "green" | "pink" | "blue" | "orange";

interface RoastCardProps {
  data: RoastResponse;
  isPremium?: boolean;
  /** League Weekly tab: headline + engine cards + optional group chat (single source from API). */
  variant?: "default" | "weekly";
}

function safeNum(n: number | undefined | null, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function accentForEngineCard(type: string): NonNullable<WrappedCardProps["accent"]> {
  const t = type.toLowerCase();
  if (t.includes("top_dog") || t.includes("group_chat")) return "green";
  if (t.includes("embarrassment") || t.includes("blowout")) return "pink";
  if (t.includes("fraud")) return "orange";
  if (t.includes("worst_coach") || t.includes("coaching")) return "blue";
  if (t.includes("carry")) return "slate";
  return "green";
}

type WeeklySlide =
  | { kind: "engine"; idx: number }
  | { kind: "matchup" };

/**
 * Some responses arrive with a truncated `cards` array (e.g. only `carry_job`), which makes the
 * UI show "Card 1 of 1" even though headline/stats/groupChatSummary are full. When we see fewer
 * than 2 engine cards, rebuild the baseline deck from stats + summary, then append any extra
 * API-only types (carry, blowout, etc.) so the carousel matches the full weekly roast.
 */
function normalizeWeeklyEngineCards(data: RoastResponse): Card[] {
  const raw = data.cards;
  const incoming: Card[] = Array.isArray(raw) ? raw : [];

  if (incoming.length >= 2) {
    return incoming;
  }

  const high = data.stats?.highestScorer;
  const low = data.stats?.lowestScorer;
  if (!high?.username || !low?.username) {
    return incoming;
  }

  const synthesized: Card[] = [
    {
      type: "top_dog",
      title: "Top Dog",
      subtitle: `${high.username} paced the league this week.`,
      stat: `${safeNum(high.score).toFixed(1)} pts`,
      tagline: "Highest score on the board.",
    },
    {
      type: "fraud_watch",
      title: "Fraud Watch",
      subtitle: `${low.username} scraped the bottom this week.`,
      stat: `${safeNum(low.score).toFixed(1)} pts`,
      tagline: "Call it a rebuild.",
    },
  ];

  const g = data.groupChatSummary?.trim();
  if (g) {
    synthesized.push({
      type: "group_chat_drop",
      title: "Group Chat Drop",
      subtitle: g.slice(0, 280) + (g.length > 280 ? "…" : ""),
      tagline: "Copy, paste, send.",
      stat: "League recap",
    });
  }

  const seen = new Set(synthesized.map((c) => c.type));
  for (const c of incoming) {
    if (!seen.has(c.type)) {
      synthesized.push(c);
      seen.add(c.type);
    }
  }

  return synthesized;
}

function WeeklyEngineLayout({ data, isPremium }: { data: RoastResponse; isPremium: boolean }) {
  const [copied, setCopied] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const summary = data.groupChatSummary?.trim();

  const engineCards = useMemo(
    () => normalizeWeeklyEngineCards(data),
    [data.cards, data.stats, data.groupChatSummary, data.headline],
  );
  const hasMatchup = Boolean(data.matchup);

  const slides: WeeklySlide[] = useMemo(() => {
    const s: WeeklySlide[] = engineCards.map((_, idx) => ({ kind: "engine" as const, idx }));
    if (hasMatchup) s.push({ kind: "matchup" });
    return s;
  }, [engineCards, hasMatchup]);

  const slideCount = slides.length;

  useEffect(() => {
    setCardIndex(0);
  }, [data.week, data.league?.league_id, slideCount]);

  const goPrev = () =>
    setCardIndex((i) => (slideCount > 0 ? (i - 1 + slideCount) % slideCount : 0));
  const goNext = () =>
    setCardIndex((i) => (slideCount > 0 ? (i + 1) % slideCount : 0));

  const copySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const currentSlide = slides[cardIndex];

  const renderEngineCard = (idx: number) => {
    const c = engineCards[idx];
    if (!c) return null;
    return (
      <WrappedCard
        kicker={c.title}
        kickerIcon={null}
        title={(c.subtitle ?? c.title).slice(0, 280)}
        {...(c.stat ? { bigValue: c.stat, statLabel: "Stat" as const } : {})}
        tagline={c.tagline}
        footer="fantasyroast.net"
        accent={accentForEngineCard(c.type)}
        isPremium={isPremium}
      />
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-muted/30 px-4 py-4 md:px-6 md:py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Week verdict</p>
        <p className="text-lg md:text-xl font-semibold text-foreground leading-snug">{data.headline}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-background/80 px-2 py-0.5">
            Avg {safeNum(data.stats.averageScore).toFixed(1)} pts
          </span>
          <span className="rounded-full border bg-background/80 px-2 py-0.5">
            High {safeNum(data.stats.highestScorer.score).toFixed(1)}
          </span>
          <span className="rounded-full border bg-background/80 px-2 py-0.5">
            Low {safeNum(data.stats.lowestScorer.score).toFixed(1)}
          </span>
        </div>
      </div>

      {summary && (
        <div className="rounded-lg border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Group chat drop</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copySummary}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      {/* Same interaction model as Season Wrapped: one card + ‹ › (not a vertical list). */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">League cards</p>
        {slideCount === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed bg-muted/20 px-3 py-4">
            No shareable league cards for this response. Generate again after scores are in.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                Card {cardIndex + 1} of {slideCount}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="h-10 w-10 rounded-xl border bg-background flex items-center justify-center interact-icon"
                  aria-label="Previous card"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="h-10 w-10 rounded-xl border bg-background flex items-center justify-center interact-icon"
                  aria-label="Next card"
                >
                  ›
                </button>
              </div>
            </div>

            {currentSlide && (
              <motion.div
                key={`${currentSlide.kind}-${currentSlide.kind === "engine" ? currentSlide.idx : "m"}`}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
              >
                {currentSlide.kind === "engine"
                  ? renderEngineCard(currentSlide.idx)
                  : data.matchup ? (
                      <WrappedCard
                        kicker="YOUR MATCHUP"
                        kickerIcon={<Swords className="w-3.5 h-3.5" />}
                        title={`${data.matchup.you.username} vs ${data.matchup.opponent.username}`}
                        subtitle={`Result: ${data.matchup.result}`}
                        bigValue={`${safeNum(data.matchup.you.score).toFixed(2)}–${safeNum(data.matchup.opponent.score).toFixed(2)}`}
                        tagline="Receipts attached."
                        footer="fantasyroast.net"
                        accent="green"
                        isPremium={isPremium}
                      />
                    ) : null}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function RoastCard({ data, isPremium = false, variant = "default" }: RoastCardProps) {
  const [index, setIndex] = useState(0);
  const [isExporting] = useState(false);

  /**
   * Weekly tab always uses the engine layout (headline + stacked league cards + matchup).
   * Do not require `data.cards.length > 0`: if that was empty/missing (older payloads, parse
   * quirks), we used to fall back to the legacy one-card-at-a-time carousel — felt broken.
   */
  const useWeeklyEngine = variant === "weekly";

  const kickerIcon = (kicker: string) => {
    const k = kicker.toLowerCase();
    if (k.includes("top dog")) return <Trophy className="w-3.5 h-3.5" />;
    if (k.includes("fraud")) return <Skull className="w-3.5 h-3.5" />;
    if (k.includes("bench")) return <Users className="w-3.5 h-3.5" />;
    if (k.includes("waiver")) return <Zap className="w-3.5 h-3.5" />;
    if (k.includes("moral")) return <TrendingDown className="w-3.5 h-3.5" />;
    if (k.includes("matchup")) return <Swords className="w-3.5 h-3.5" />;
    return null;
  };

  const cards = useMemo(() => {
    const leagueTitle = data?.league?.name || "Your League";
    const weekTitle = `Week ${data?.week ?? 1}`;

    const deck: Array<{
      kicker: string;
      title: string;
      subtitle?: string;
      bigValue?: string;
      tagline?: string;
      footer?: string;
      accent: Accent;
      isMatchup?: boolean;
      matchupData?: {
        teamA: string;
        scoreA: number;
        teamB: string;
        scoreB: number;
      };
    }> = [
      {
        kicker: "ROAST WRAPPED",
        title: "ROAST YOUR\nLEAGUE",
        subtitle: `${leagueTitle} • ${weekTitle}`,
        bigValue: undefined,
        tagline: "Made with Fantasy Roast",
        footer: "fantasyroast.net",
        accent: "green",
      },
      {
        kicker: "TOP DOG",
        title: data.stats.highestScorer.username.toUpperCase(),
        subtitle: "Carried the league on their back.",
        bigValue: `${safeNum(data.stats.highestScorer.score).toFixed(2)} pts`,
        tagline: "Unreal scenes.",
        footer: "fantasyroast.net",
        accent: "green",
      },
      {
        kicker: "THE FRAUD",
        title: data.stats.lowestScorer.username.toUpperCase(),
        subtitle: "This wasn’t a bad week. This was a crime scene.",
        bigValue: `${safeNum(data.stats.lowestScorer.score).toFixed(2)} pts`,
        tagline: "Call it a rebuild.",
        footer: "fantasyroast.net",
        accent: "pink",
      },
    ];

    if (data.matchup) {
      const a = data.matchup.you;
      const b = data.matchup.opponent;
      const aScore = safeNum(a.score);
      const bScore = safeNum(b.score);
      const margin = Math.abs(aScore - bScore);
      const isBlowout = margin >= 25;
      const isNailBiter = margin <= 5;
      const result = data.matchup.result;
      const punchline =
        result === "WIN"
          ? isBlowout
            ? "You obliterated them."
            : isNailBiter
              ? "You stole it."
              : "You handled business."
          : result === "LOSS"
            ? isBlowout
              ? "You got erased."
              : isNailBiter
                ? "Heartbreaker."
                : "You got clipped."
            : "Dead even. The league will argue about this.";
      deck.push({
        kicker: "YOUR MATCHUP",
        title: `${a.username.toUpperCase()} vs ${b.username.toUpperCase()}`,
        subtitle: `Result: ${result} • ${punchline}`,
        bigValue: `${aScore.toFixed(2)}–${bScore.toFixed(2)}`,
        tagline: "Receipts attached.",
        footer: "fantasyroast.net",
        accent: "green",
        isMatchup: true,
        matchupData: {
          teamA: a.username,
          scoreA: aScore,
          teamB: b.username,
          scoreB: bScore,
        },
      });
    } else {
      deck.push({
        kicker: "YOUR MATCHUP",
        title: "NO MATCHUP YET",
        subtitle: "Once week matchups exist, this card becomes 🔥",
        bigValue: "—",
        tagline: "Wire it to matchups endpoint.",
        footer: "fantasyroast.net",
        accent: "green",
      });
    }

    return deck;
  }, [data]);

  if (useWeeklyEngine) {
    return <WeeklyEngineLayout data={data} isPremium={isPremium} />;
  }

  const total = cards.length;
  const current = cards[index];

  const goPrev = () => {
    setIndex((i) => (i - 1 + total) % total);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % total);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Card {index + 1} of {total}
        </div>

        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Previous card"
            disabled={isExporting}
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Next card"
            disabled={isExporting}
          >
            ›
          </button>
        </div>
      </div>

      <WrappedCard
        kicker={current.kicker}
        kickerIcon={kickerIcon(current.kicker)}
        title={current.title}
        subtitle={current.subtitle}
        bigValue={current.bigValue}
        tagline={current.tagline}
        footer={current.footer}
        accent={current.accent}
        isPremium={isPremium}
      />
    </div>
  );
}
