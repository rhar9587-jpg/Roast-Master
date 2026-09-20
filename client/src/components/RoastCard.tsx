import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  TrendingDown,
  Swords,
  Users,
  Zap,
  Skull,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import type { Card, RoastResponse } from "@shared/schema";
import { track } from "@/lib/track";
import { getYoursLine, SHARE_FOOTER } from "@/lib/brand";
import { WrappedCard } from "@/components/WrappedCard";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { mapEngineCardToVisual } from "@/pages/LeagueHistory/weeklyShareCards";

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

  // Text-only group chat cards are not share graphics — keep them out of the carousel.
  const visualIncoming = incoming.filter((c) => c.type !== "group_chat_drop");

  if (visualIncoming.length >= 2) {
    return visualIncoming;
  }

  const high = data.stats?.highestScorer;
  const low = data.stats?.lowestScorer;
  if (!high?.username || !low?.username) {
    return visualIncoming;
  }

  const synthesized: Card[] = [
    {
      type: "top_dog",
      title: "Top Dog",
      subtitle: `${high.username} paced the league this week.`,
      stat: `${safeNum(high.score).toFixed(1)} pts`,
      tagline: "Highest score on the board.",
      meta: { roster_id: high.roster_id, score: high.score, username: high.username },
    },
    {
      type: "lowest_scorer",
      title: "Straight to Jail",
      subtitle: `${low.username} scraped the bottom this week.`,
      stat: `${safeNum(low.score).toFixed(1)} pts`,
      tagline: "Lowest score of the week.",
      meta: { username: low.username, score: low.score },
    },
  ];

  const seen = new Set(synthesized.map((c) => c.type));
  for (const c of visualIncoming) {
    if (!seen.has(c.type)) {
      synthesized.push(c);
      seen.add(c.type);
    }
  }

  return synthesized;
}

/** Safe read of engine `signals` (Zod record) for optional UI chips / “more this week”. */
function parseWeeklySignals(data: RoastResponse) {
  const s = data.signals;
  if (!s || typeof s !== "object") return null;
  const rec = s as Record<string, unknown>;
  const medianScore = typeof rec.medianScore === "number" ? rec.medianScore : null;
  const closestMargin =
    typeof rec.closestMargin === "number" ? rec.closestMargin : null;
  const blowoutMargin =
    typeof rec.blowoutMargin === "number" ? rec.blowoutMargin : null;
  let closestGame: {
    teamA: string;
    teamB: string;
    scoreA: number;
    scoreB: number;
  } | null = null;
  const cg = rec.closestGame;
  if (cg && typeof cg === "object" && cg !== null) {
    const g = cg as Record<string, unknown>;
    if (
      typeof g.teamA === "string" &&
      typeof g.teamB === "string" &&
      (typeof g.scoreA === "number" || typeof g.scoreA === "string") &&
      (typeof g.scoreB === "number" || typeof g.scoreB === "string")
    ) {
      closestGame = {
        teamA: g.teamA,
        teamB: g.teamB,
        scoreA: Number(g.scoreA),
        scoreB: Number(g.scoreB),
      };
    }
  }
  const hasAny =
    medianScore != null ||
    closestMargin != null ||
    blowoutMargin != null ||
    closestGame != null;
  if (!hasAny) return null;
  return { medianScore, closestMargin, blowoutMargin, closestGame };
}

function buildWeeklyRoastClipboardText(data: RoastResponse): string {
  const lines: string[] = ["🔥 Fantasy Roast 🔥", ""];

  lines.push(data.headline.trim());

  const low = data.stats.lowestScorer;
  lines.push(`💀 Biggest embarrassment: ${low.username} (${safeNum(low.score).toFixed(1)} pts 💀)`);

  const sig = parseWeeklySignals(data);
  if (sig?.closestGame) {
    lines.push(`🔥 Rivalry: ${sig.closestGame.teamA} vs ${sig.closestGame.teamB}`);
  } else if (data.matchup) {
    lines.push(`🔥 Rivalry: ${data.matchup.you.username} vs ${data.matchup.opponent.username}`);
  }

  lines.push("", getYoursLine());
  return lines.join("\n");
}

function WeeklyEngineLayout({ data, isPremium }: { data: RoastResponse; isPremium: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copiedMatchup, setCopiedMatchup] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const summary = data.groupChatSummary?.trim();
  const signalsParsed = useMemo(() => parseWeeklySignals(data), [data.signals]);

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

  const roastClipboardText = useMemo(() => buildWeeklyRoastClipboardText(data), [data]);

  const shareWeek = async () => {
    setShareBusy(true);
    try {
      track("weekly_share_clicked", {
        week: data.week,
        league_id: data.league.league_id,
      });
      const shareText = roastClipboardText;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({
            title: `Week ${data.week} Roast`,
            text: shareText,
          });
          return;
        } catch {
          /* fall through to clipboard */
        }
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    } finally {
      setShareBusy(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(roastClipboardText);
      track("weekly_roast_copied", {
        league_id: data.league.league_id,
        week: data.week,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const copyMatchupLine = async () => {
    if (!data.matchup) return;
    const m = data.matchup;
    const line = `${m.you.username} vs ${m.opponent.username} — ${safeNum(m.you.score).toFixed(2)}–${safeNum(m.opponent.score).toFixed(2)} — ${m.result}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopiedMatchup(true);
      setTimeout(() => setCopiedMatchup(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const currentSlide = slides[cardIndex];

  const renderEngineCard = (idx: number) => {
    const c = engineCards[idx];
    if (!c) return null;
    const visual = mapEngineCardToVisual(c, data.week, data);
    return (
      <WrappedCard
        kicker={visual.kicker}
        kickerIcon={null}
        title={visual.title}
        subtitle={visual.subtitle}
        {...(visual.bigValue
          ? { bigValue: visual.bigValue, statLabel: visual.statLabel ?? "Stat" }
          : {})}
        tagline={visual.tagline}
        footer={SHARE_FOOTER}
        accent={visual.accent}
        isMatchup={visual.isMatchup}
        matchupData={visual.matchupData}
        isPremium={isPremium}
      />
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Week {data.week}
          {data.league?.name ? ` · ${data.league.name}` : ""}
        </p>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
          {data.headline}
        </h2>
      </div>

      {/* Shareable roast cards — hero */}
      <div className="space-y-2">
        {slideCount === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed bg-muted/20 px-3 py-4">
            No shareable league cards for this week yet. Check back when scores are in.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {slideCount} share card{slideCount === 1 ? "" : "s"}
              </p>
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
                        title={
                          data.matchup.result === "WIN"
                            ? "HANDLED BUSINESS"
                            : data.matchup.result === "LOSS"
                              ? "TOOK THE L"
                              : data.matchup.result === "TIE"
                                ? "DEAD EVEN"
                                : "PENDING"
                        }
                        isMatchup
                        matchupData={{
                          teamA: data.matchup.you.username,
                          scoreA: safeNum(data.matchup.you.score),
                          teamB: data.matchup.opponent.username,
                          scoreB: safeNum(data.matchup.opponent.score),
                          margin: Math.abs(
                            safeNum(data.matchup.you.score) - safeNum(data.matchup.opponent.score),
                          ),
                        }}
                        bigValue={`+${Math.abs(
                          safeNum(data.matchup.you.score) - safeNum(data.matchup.opponent.score),
                        ).toFixed(1)}`}
                        tagline="Receipts attached."
                        footer={SHARE_FOOTER}
                        accent="green"
                        isPremium={isPremium}
                      />
                    ) : null}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Primary share action */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto font-bold interact-cta"
          disabled={shareBusy}
          onClick={() => void shareWeek()}
        >
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied" : shareBusy ? "Sharing…" : `Share Week ${data.week}`}
        </Button>

        <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              More share options
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${secondaryOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {summary && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Group chat text
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyText()}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy text"}
              </Button>
              {data.matchup && (
                <Button type="button" variant="outline" size="sm" onClick={() => void copyMatchupLine()}>
                  {copiedMatchup ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copiedMatchup ? "Copied" : "Copy matchup line"}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Download PNG from any card above when you want a story asset.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Supporting detail */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border bg-background/80 px-2 py-0.5">
          Avg {safeNum(data.stats.averageScore).toFixed(1)} pts
        </span>
        <span className="rounded-md border bg-background/80 px-2 py-0.5">
          High {safeNum(data.stats.highestScorer.score).toFixed(1)}
        </span>
        <span className="rounded-md border bg-background/80 px-2 py-0.5">
          Low {safeNum(data.stats.lowestScorer.score).toFixed(1)}
        </span>
        {signalsParsed?.medianScore != null && (
          <span className="rounded-md border bg-background/80 px-2 py-0.5">
            Median {safeNum(signalsParsed.medianScore).toFixed(1)}
          </span>
        )}
      </div>

      {signalsParsed && (
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full max-w-3xl mx-auto items-center justify-between rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/40"
            >
              <span>More from this week</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="max-w-3xl mx-auto space-y-2 pt-2 text-xs text-muted-foreground">
            {signalsParsed.closestGame && (
              <p>
                <span className="font-medium text-foreground">Closest game: </span>
                {signalsParsed.closestGame.teamA} {signalsParsed.closestGame.scoreA.toFixed(2)} –{" "}
                {signalsParsed.closestGame.teamB} {signalsParsed.closestGame.scoreB.toFixed(2)}
              </p>
            )}
            {signalsParsed.closestMargin != null && (
              <p>
                <span className="font-medium text-foreground">Closest margin: </span>
                {safeNum(signalsParsed.closestMargin).toFixed(2)} pts
              </p>
            )}
            {signalsParsed.blowoutMargin != null && (
              <p>
                <span className="font-medium text-foreground">Biggest blowout margin: </span>
                {safeNum(signalsParsed.blowoutMargin).toFixed(2)} pts
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
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
        margin?: number;
      };
    }> = [
      {
        kicker: "ROAST WRAPPED",
        title: "ROAST YOUR\nLEAGUE",
        subtitle: `${leagueTitle} • ${weekTitle}`,
        bigValue: undefined,
        tagline: "Made with Fantasy Roast",
        footer: SHARE_FOOTER,
        accent: "green",
      },
      {
        kicker: "TOP DOG",
        title: data.stats.highestScorer.username.toUpperCase(),
        subtitle: "Carried the league on their back.",
        bigValue: `${safeNum(data.stats.highestScorer.score).toFixed(2)} pts`,
        tagline: "Unreal scenes.",
        footer: SHARE_FOOTER,
        accent: "green",
      },
      {
        kicker: "THE FRAUD",
        title: data.stats.lowestScorer.username.toUpperCase(),
        subtitle: "This wasn’t a bad week. This was a crime scene.",
        bigValue: `${safeNum(data.stats.lowestScorer.score).toFixed(2)} pts`,
        tagline: "Call it a rebuild.",
        footer: SHARE_FOOTER,
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
            : result === "TIE"
              ? "Dead even. The league will argue about this."
              : "Still playing — don't count the W yet.";
      deck.push({
        kicker: "YOUR MATCHUP",
        title:
          result === "WIN"
            ? "HANDLED BUSINESS"
            : result === "LOSS"
              ? "TOOK THE L"
              : result === "TIE"
                ? "DEAD EVEN"
                : "PENDING",
        subtitle: punchline,
        bigValue: `+${margin.toFixed(1)}`,
        tagline: "Receipts attached.",
        footer: SHARE_FOOTER,
        accent: "green",
        isMatchup: true,
        matchupData: {
          teamA: a.username,
          scoreA: aScore,
          teamB: b.username,
          scoreB: bScore,
          margin,
        },
      });
    } else {
      deck.push({
        kicker: "YOUR MATCHUP",
        title: "NO MATCHUP YET",
        subtitle: "Once week matchups exist, this card becomes 🔥",
        bigValue: "—",
        tagline: "Wire it to matchups endpoint.",
        footer: SHARE_FOOTER,
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
        isMatchup={current.isMatchup}
        matchupData={current.matchupData}
        isPremium={isPremium}
      />
    </div>
  );
}
