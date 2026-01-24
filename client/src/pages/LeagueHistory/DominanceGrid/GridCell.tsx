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
  const bg = scoreToBg(cell.score, cell.games);

  if (forExport) {
    return (
      <div
        className={`border p-2 text-left ${bg}`}
        data-cell-export
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[10px] rounded px-1.5 py-0.5 ${badgePill(
              cell.badge
            )}`}
          >
            {getBadgeDisplayName(cell.badge)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {cell.games}g
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold">
          {cell.score >= 0 ? "+" : ""}
          {cell.score.toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground">{cell.record}</div>
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

  const tooltipContent = (
    <div className="text-xs space-y-1">
      <div className="font-medium">
        {cell.aName} vs {cell.bName}
      </div>
      <div>
        {getBadgeDisplayName(cell.badge)} • {cell.record} • Score{" "}
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
            className={`border p-2 text-left transition-all duration-200 hover:opacity-90 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${bg} ${filterClasses}`}
            onClick={onSelect}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] rounded px-1.5 py-0.5 ${badgePill(
                  cell.badge
                )}`}
              >
                {getBadgeDisplayName(cell.badge)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {cell.games}g
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold">
              {cell.score >= 0 ? "+" : ""}
              {cell.score.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">{cell.record}</div>
          </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
