import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Share2 } from "lucide-react";
import { exportCardPng, dataUrlToFile, downloadDataUrl } from "@/lib/exportCardImage";
import { WatermarkOverlay } from "@/components/ui/WatermarkOverlay";

type WrappedCardProps = {
  kicker?: string;
  kickerIcon?: React.ReactNode;
  title: string;
  subtitle?: string;
  bigValue?: string;
  statLabel?: string; // Label above big stat (defaults to "Points")
  extraLine?: string; // Extra info line (e.g., PF/PA)
  tagline?: string;
  footer?: string;
  accent?: "green" | "pink" | "blue" | "orange" | "slate";
  isMatchup?: boolean;
  matchupData?: {
    teamA: string;
    scoreA: number;
    teamB: string;
    scoreB: number;
  };
  showScoreBug?: boolean;
  onToggleScoreBug?: () => void;
  isPremium?: boolean;
};

const accentClasses: Record<NonNullable<WrappedCardProps["accent"]>, string> = {
  green: "from-emerald-400 via-lime-300 to-emerald-400",
  pink: "from-fuchsia-500 via-pink-400 to-orange-300",
  blue: "from-cyan-400 via-sky-400 to-indigo-400",
  orange: "from-orange-400 via-amber-300 to-pink-300",
  slate: "from-slate-400 via-slate-500 to-indigo-400",
};

export function WrappedCard({
  kicker,
  kickerIcon,
  title,
  subtitle,
  bigValue,
  statLabel = "Points",
  extraLine,
  tagline,
  footer = "Made with Fantasy Roast",
  accent = "green",
  isMatchup,
  matchupData,
  showScoreBug,
  onToggleScoreBug,
  isPremium = false,
}: WrappedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filename = useMemo(() => {
    const safe = (title || "roast-wrapped")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${safe}.png`;
  }, [title]);

  const downloadPng = async () => {
    if (!ref.current) return;
    setIsExporting(true);
    try {
      const { dataUrl } = await exportCardPng({
        element: ref.current,
        filename,
        isPremium,
      });
      downloadDataUrl(dataUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const smartShare = async () => {
    if (!ref.current) return;
    setIsExporting(true);

    try {
      const shareText = "My Fantasy Wrapped";
      const shareUrl = window.location.href;

      const { dataUrl } = await exportCardPng({
        element: ref.current,
        filename,
        caption: shareText,
        isPremium,
      });

      const file = await dataUrlToFile(dataUrl, filename);

      if ("share" in navigator && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Fantasy Roast",
          text: shareText,
          files: [file],
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(isPremium ? "Link copied ✅" : "Link copied ✅ (Unlock for clean exports)");
        return;
      }

      downloadDataUrl(dataUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl shadow-2xl overflow-hidden border border-border/50 bg-white"
      >
        {/* Exported area */}
        <div ref={ref} className="bg-[#0b0b0f] relative">
          {/* Watermark for free users - visible in preview and export */}
          <WatermarkOverlay show={!isPremium} theme="dark" />
          
          <div className={`h-3 bg-gradient-to-r ${accentClasses[accent]}`} />

          <div className="p-10 md:p-12">
            {/* Kicker pill (with icon) */}
            {kicker ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-white/60 uppercase">
                {kickerIcon ? <span className="text-white/70">{kickerIcon}</span> : null}
                <span>{kicker}</span>
              </div>
            ) : null}

            {/* Title + subtitle */}
            <div className="mt-5 text-white">
              <div className="text-4xl md:text-6xl font-black leading-[0.9] whitespace-pre-line">
                {title}
              </div>
              {subtitle ? (
                <div className="mt-3 text-sm md:text-base text-white/55 font-medium whitespace-pre-line">
                  {subtitle}
                </div>
              ) : null}
            </div>

            {/* Big stat */}
            {bigValue ? (
              <div className="mt-6">
                <div className="text-white/40 text-[10px] font-bold tracking-widest uppercase">
                  {statLabel}
                </div>
                <div className="mt-1 text-4xl sm:text-6xl md:text-8xl font-black text-white break-words">
                  {bigValue}
                </div>
              </div>
            ) : null}

            {/* Extra info line (e.g., PF/PA) */}
            {extraLine ? (
              <div className="mt-4 text-white/50 text-sm font-medium">
                {extraLine}
              </div>
            ) : null}

            {/* Tagline */}
            {tagline ? (
              <div className="mt-6 text-white/70 text-base md:text-lg italic">
                "{tagline}"
              </div>
            ) : null}

            {/* Footer */}
            <div className="mt-10 flex items-start justify-between gap-3 text-white/40 font-semibold tracking-wide">
              <div 
                className={`teamName min-w-0 flex-1 ${
                  footer && footer.length > 25 ? "text-[9px]" : "text-[10px]"
                }`}
              >
                {footer}
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] whitespace-nowrap shrink-0">fantasyroast.net</div>
            </div>
          </div>
        </div>

        {/* Share controls (not exported) */}
        <div className="p-4 bg-white flex flex-col gap-2">
          <div className="flex gap-2 justify-end">
            <button
              onClick={downloadPng}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-primary text-primary-foreground font-semibold disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Preparing…" : "Download PNG"}
            </button>

            <div className="relative group">
              <button
                onClick={smartShare}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-muted text-foreground font-semibold disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" />
                Post the Roast
              </button>

              <div
                role="tooltip"
                className="
                  pointer-events-none absolute -top-11 right-0 z-50
                  whitespace-nowrap rounded-lg bg-black/90 px-3 py-2
                  text-xs font-semibold text-white shadow-lg
                  opacity-0 translate-y-1 transition
                  group-hover:opacity-100 group-hover:translate-y-0
                "
              >
                Let the league witness this.
                <div className="absolute right-4 top-full h-2 w-2 rotate-45 bg-black/90" />
              </div>
            </div>
          </div>
          {!isPremium && (
            <p className="text-xs text-gray-500 text-right">
              Watermark removed when you unlock ($19 — ends Feb 10)
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
