import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
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

export function SeasonWrappedCard({ data }: { data: WrappedApiResponse }) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const cards = data?.wrapped?.cards ?? [];
  const total = cards.length || 1;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  const accentFor = (type: string): Accent => {
    const t = (type || "").toLowerCase();
    if (t.includes("mvp") || t.includes("season")) return "green";
    if (t.includes("worst") || t.includes("regret")) return "pink";
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

  const filename = useMemo(() => {
    const safe = (current.title || "season-wrapped")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$|/g, "");
    return `${safe || "season-wrapped"}.png`;
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

      const shareText = "My Fantasy Season Wrapped";

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Season Wrapped", text: shareText, files: [file] });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      window.open(dataUrl, "_blank");
    } finally {
      setIsExporting(false);
    }
  }

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

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <div ref={cardRef}>
          <WrappedCard
            kicker="SEASON WRAPPED"
            title={current.title}
            subtitle={current.subtitle}
            bigValue={current.stat || "—"}
            footer="fantasyroast.net"
            accent={accentFor(current.type)}
          />
        </div>

        {/* Optional: if you want download/share buttons on wrapped too, add them here */}
        {/* Keeping identical to your "previous version" by default. */}
      </motion.div>
    </div>
  );
}
