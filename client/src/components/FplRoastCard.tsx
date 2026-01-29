import { useState } from "react";
import { motion } from "framer-motion";
import { WrappedCard } from "@/components/WrappedCard";
import type { FplRoastResponse, FplCard } from "@shared/schema";
import { Crown, Armchair, ArrowRightLeft, TrendingDown, Scale } from "lucide-react";

const cardIcon = (id: string) => {
  if (id === "verdict") return <Scale className="w-3 h-3" />;
  if (id === "captaincy") return <Crown className="w-3 h-3" />;
  if (id === "bench") return <Armchair className="w-3 h-3" />;
  if (id === "transfers") return <ArrowRightLeft className="w-3 h-3" />;
  if (id === "differential") return <TrendingDown className="w-3 h-3" />;
  return null;
};

export function FplRoastCard({ data }: { data: FplRoastResponse }) {
  const [index, setIndex] = useState(0);

  const cards = data?.cards ?? [];
  const total = cards.length || 1;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const current: FplCard =
    cards[index] ||
    ({
      id: "empty",
      title: "FPL Roast",
      subtitle: "No cards available",
      bigValue: "-",
      footer: "",
      accent: "blue",
    } as const);

  const managerName = data.entry?.name || 
    [data.entry?.player_first_name, data.entry?.player_last_name].filter(Boolean).join(" ") ||
    "Manager";

  return (
    <div className="w-full max-w-3xl mx-auto" data-testid="fpl-roast-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Card {index + 1} of {total}
        </div>

        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Previous card"
            data-testid="button-fpl-prev"
          >
            &#8249;
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center interact-icon"
            aria-label="Next card"
            data-testid="button-fpl-next"
          >
            &#8250;
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
          kicker={`FPL GW${data.eventId}`}
          kickerIcon={cardIcon(current.id)}
          title={current.title}
          subtitle={
            current.id === "captaincy" && current.tagline && current.footer
              ? `${current.subtitle}\n${current.footer}`
              : current.subtitle
          }
          tagline={current.tagline || current.footer}
          bigValue={current.bigValue || "-"}
          footer={managerName}
          accent={current.accent || "blue"}
        />
      </motion.div>
    </div>
  );
}
