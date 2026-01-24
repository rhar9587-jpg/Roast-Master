import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
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

export function LeagueAutopsyCard({ data }: { data: LeagueAutopsyResponse }) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const filename = useMemo(() => {
    const safe = (current.title || "league-autopsy")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$|/g, "");
    return `${safe || "league-autopsy"}.png`;
  }, [current.title]);

  async function downloadPng() {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } finally {
      setIsExporting(false);
    }
  }

  async function sharePng() {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      const shareText = "League Autopsy - The season, as it happened.";

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "League Autopsy", text: shareText, files: [file] });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      window.open(dataUrl, "_blank");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto" data-testid="league-autopsy-card">
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
            data-testid="button-autopsy-prev"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="h-10 w-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
            aria-label="Next card"
            disabled={isExporting}
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
        <div ref={cardRef}>
          <WrappedCard
            kicker="LEAGUE AUTOPSY"
            kickerIcon={kickerIcon(current.type)}
            title={current.title}
            subtitle={current.subtitle}
            tagline={current.tagline}
            bigValue={current.stat || "—"}
            footer={data?.league?.name || "fantasyroast.net"}
            accent={accentFor(current.type)}
          />
        </div>
      </motion.div>
    </div>
  );
}
