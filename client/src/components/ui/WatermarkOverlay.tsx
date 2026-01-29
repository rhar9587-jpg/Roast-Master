import * as React from "react";

interface WatermarkOverlayProps {
  /** Text to display in the watermark */
  text?: string;
  /** Whether to show the watermark (typically !isPremium) */
  show: boolean;
  /** Light or dark theme for contrast */
  theme?: "light" | "dark";
}

/**
 * A prominent diagonal watermark overlay that:
 * - Is visible in the UI preview (what you see is what you share)
 * - Covers the center of the content (hard to crop)
 * - Creates friction for free users without being ugly
 */
export function WatermarkOverlay({
  text = "UNLOCK FOR $19 • fantasyroast.app",
  show,
  theme = "light",
}: WatermarkOverlayProps) {
  if (!show) return null;

  const textColor = theme === "light" 
    ? "text-black/[0.15]" 
    : "text-white/[0.20]";

  return (
    <div 
      className="pointer-events-none absolute inset-0 overflow-hidden z-10"
      aria-hidden="true"
    >
      {/* Multiple diagonal lines for full coverage */}
      <div className="absolute inset-0 flex flex-col justify-center items-center gap-12 -rotate-[25deg] scale-150">
        {[-2, -1, 0, 1, 2].map((offset) => (
          <div
            key={offset}
            className={`whitespace-nowrap text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase ${textColor}`}
            style={{ transform: `translateY(${offset * 60}px)` }}
          >
            {text} &nbsp;&nbsp;&nbsp; {text} &nbsp;&nbsp;&nbsp; {text}
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/70">
        Unlock for $19 • fantasyroast.app
      </div>
    </div>
  );
}
