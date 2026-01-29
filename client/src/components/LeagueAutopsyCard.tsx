import { useState } from "react";
import { motion } from "framer-motion";
import { WrappedCard } from "@/components/WrappedCard";
import type { LeagueAutopsyResponse } from "@shared/schema";
import { Skull, TrendingUp, TrendingDown, Zap, Scale } from "lucide-react";

type Accent = "green" | "pink" | "blue" | "orange";

const kickerIcon = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("last_place")) return <Skull className="w-3 h-3" />;
  if (t.includes("season_high") || t.includes("peak")) return <TrendingUp className="w-3 h-3" />;
  if (t.includes("season_low") || t.includes("crime")) return <TrendingDown className="w-3 h-3" />;
  if (t.includes("blowout") || t.includes("game_over")) return <Zap className="w-3 h-3" />;
  if (t.includes("highest_loss") || t.includes("injustice")) return <Scale className="w-3 h-3" />;
  return null;
};

interface LeagueAutopsyCardProps {
  data: LeagueAutopsyResponse;
  isPremium?: boolean;
}

export function LeagueAutopsyCard({ data, isPremium = false }: LeagueAutopsyCardProps) {
  const [index, setIndex] = useState(0);

  const cards = data?.cards ?? [];
  const total = cards.length || 1;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const accentFor = (type: string): Accent => {
    const t = (type || "").toLowerCase();
    if (t.includes("last_place")) return "pink";
    if (t.includes("season_high") || t.includes("peak")) return "green";
    if (t.includes("season_low") || t.includes("crime")) return "orange";
    if (t.includes("blowout") || t.includes("game_over")) return "blue";
    if (t.includes("highest_loss") || t.includes("injustice")) return "pink";
    return "blue";
  };

  const current =
    cards[index] ||
    ({
      type: "autopsy_result",
      title: "League Autopsy",
      subtitle: "No autopsy cards yet",
      stat: "—",
    } as const);

  return (
    <div className="w-full max-w-3xl mx-auto" data-testid="league-autopsy-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Card {index + 1} of {total}
        </div>

        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Previous card"
            data-testid="button-autopsy-prev"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Next card"
            data-testid="button-autopsy-next"
          >
            ›
          </button>
        </div>
      </div>

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <WrappedCard
          kicker="LEAGUE AUTOPSY"
          kickerIcon={kickerIcon(current.type)}
          title={current.title}
          subtitle={current.subtitle}
          tagline={current.tagline}
          bigValue={current.stat || "—"}
          footer={data?.league?.name || "fantasyroast.net"}
          accent={accentFor(current.type)}
          isPremium={isPremium}
        />
      </motion.div>
    </div>
  );
}
