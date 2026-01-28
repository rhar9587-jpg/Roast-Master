import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingDown, Swords, Users, Zap, Skull } from "lucide-react";
import type { RoastResponse } from "@shared/schema";
import { WrappedCard } from "@/components/WrappedCard";

type Accent = "green" | "pink" | "blue" | "orange";

interface RoastCardProps {
  data: RoastResponse;
  isPremium?: boolean;
}

function safeNum(n: number | undefined | null, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function RoastCard({ data, isPremium = false }: RoastCardProps) {
  const [index, setIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showScoreBug, setShowScoreBug] = useState(false);

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
        }
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

  const total = cards.length;
  const current = cards[index];

  const goPrev = () => {
    setIndex((i) => (i - 1 + total) % total);
    setShowScoreBug(false);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % total);
    setShowScoreBug(false);
  };

  const canShowScoreBug = useMemo(() => {
    // Check if the current card is a matchup AND has valid matchup data
    if (!current.isMatchup || !current.matchupData) return false;
    
    // Safety check for score values
    const scoreA = safeNum(current.matchupData.scoreA);
    const scoreB = safeNum(current.matchupData.scoreB);
    
    // Eligibility criteria: blowout (margin >= 35) or defensive battle (total < 170)
    const margin = Math.abs(scoreA - scoreB);
    const totalScore = scoreA + scoreB;
    
    return margin >= 35 || totalScore < 170;
  }, [current]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Card {index + 1} of {total}
        </div>

        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
            aria-label="Previous card"
            disabled={isExporting}
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
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
