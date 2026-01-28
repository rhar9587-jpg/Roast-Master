import { useState } from "react";
import { motion } from "framer-motion";
import { WrappedCard } from "@/components/WrappedCard";

type Accent = "green" | "pink" | "blue" | "orange";

type WrappedApiResponse = {
  league_id: string;
  roster_id: number;
  wrapped: {
    cards: Array<{
      type: string;
      title: string;
      subtitle?: string;
      stat?: string;
    }>;
  };
};

interface SeasonWrappedCardProps {
  data: WrappedApiResponse;
  isPremium?: boolean;
}

export function SeasonWrappedCard({ data, isPremium = false }: SeasonWrappedCardProps) {
  const [index, setIndex] = useState(0);

  const cards = data?.wrapped?.cards ?? [];
  const total = cards.length || 1;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const accentFor = (type: string): Accent => {
    const t = (type || "").toLowerCase();
    if (t.includes("mvp") || t.includes("season") || t.includes("best")) return "green";
    if (t.includes("worst") || t.includes("regret") || t.includes("enemy") || t.includes("choke")) return "pink";
    if (t.includes("style")) return "blue";
    return "orange";
  };

  const current =
    cards[index] ||
    ({
      type: "season_result",
      title: "Season Wrapped",
      subtitle: "No wrapped cards yet",
      stat: "—",
    } as const);

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
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
            aria-label="Next card"
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
          kicker="SEASON WRAPPED"
          title={current.title}
          subtitle={current.subtitle}
          bigValue={current.stat || "—"}
          footer="fantasyroast.net"
          accent={accentFor(current.type)}
          isPremium={isPremium}
        />
      </motion.div>
    </div>
  );
}
