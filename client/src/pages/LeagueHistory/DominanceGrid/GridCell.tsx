import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  scoreToBg,
  badgePill,
  getBadgeDisplayName,
  fmtScore,
} from "../utils";
import type { Badge } from "../types";
import type { DominanceCellDTO } from "../types";

type Props = {
  cell: DominanceCellDTO;
  forExport: boolean;
  applyFilter: boolean;
  filterBadge: Badge | null;
  onSelect: () => void;
};

export function GridCell({
  cell,
  forExport,
  applyFilter,
  filterBadge,
  onSelect,
}: Props) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  let bg = scoreToBg(cell.score, cell.games);
  // Remove shadows for export (may not render well in PNG)
  if (forExport) {
    bg = bg.replace(/shadow-\S+/g, "").trim();
  }

  if (forExport) {
    return (
      <div
        className={`p-2 text-left ${bg}`}
        data-cell-export
      >
        <div className="mb-1 overflow-hidden">
          <span className={`${badgePill(cell.badge)} inline-block max-w-full truncate`}>
            {getBadgeDisplayName(cell.badge)}
          </span>
        </div>
        <div className="text-lg font-bold leading-tight">{cell.record}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {cell.score >= 0 ? "+" : ""}
          {cell.score.toFixed(2)}
        </div>
      </div>
    );
  }

  const isMatch = applyFilter && cell.badge === filterBadge;
  const isDeemphasised = applyFilter && cell.badge !== filterBadge;
  const filterClasses = isMatch
    ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
    : isDeemphasised
      ? "opacity-20 grayscale"
      : "";

  // Hero treatment for OWNED and NEMESIS
  const heroRing =
    cell.badge === "OWNED"
      ? "ring-2 ring-inset ring-emerald-400/40"
      : cell.badge === "NEMESIS"
        ? "ring-2 ring-inset ring-rose-400/40"
        : "";

  const isHeroBadge = cell.badge === "OWNED" || cell.badge === "NEMESIS";
  
  function handleInteraction() {
    if (!forExport && isHeroBadge && !hasInteracted) {
      setHasInteracted(true);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
  }

  const tooltipFirstLine = isHeroBadge
    ? cell.badge === "OWNED"
      ? "You OWN them 👑"
      : "They OWN you 💀"
    : null;

  const tooltipContent = (
    <div className="text-xs space-y-1">
      {tooltipFirstLine ? (
        <>
          <div className="font-medium">
            {tooltipFirstLine}
          </div>
          <div className="text-muted-foreground">
            {cell.aName} vs {cell.bName}
          </div>
        </>
      ) : (
        <div className="font-medium">
          {cell.aName} vs {cell.bName}
        </div>
      )}
      <div>
        {cell.record} • {getBadgeDisplayName(cell.badge)} • Score{" "}
        {fmtScore(cell.score)}
      </div>
      <div className="text-muted-foreground">
        {cell.games} games • PF {cell.pf.toFixed(1)} / PA {cell.pa.toFixed(1)}
      </div>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
            type="button"
            className={`p-2 text-left transition-all duration-200 hover:opacity-90 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${bg} ${filterClasses} ${heroRing} ${!forExport && isAnimating ? "animate-pulse" : ""}`}
            onClick={() => {
              handleInteraction();
              onSelect();
            }}
            onMouseEnter={handleInteraction}
            onTouchStart={handleInteraction}
          >
            <div className="mb-1 overflow-hidden">
              <span className={`${badgePill(cell.badge)} inline-block max-w-full truncate`}>
                {getBadgeDisplayName(cell.badge)}
              </span>
            </div>
            <div className="text-lg font-bold leading-tight">{cell.record}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {cell.score >= 0 ? "+" : ""}
              {cell.score.toFixed(2)}
            </div>
          </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs !bg-background">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
