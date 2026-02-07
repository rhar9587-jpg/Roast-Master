import { GridToolbar } from "./GridToolbar";
import { GridTable } from "./GridTable";
import { GridSkeleton } from "./GridSkeleton";
import { LegendFooter } from "./LegendFooter";
import { BADGES } from "../utils";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import type {
  Badge,
  ManagerRow,
  RowTotal,
  GrandTotal,
  DominanceCellDTO,
} from "../types";

const FREE_ROW_COUNT = 3;

type Props = {
  managers: ManagerRow[];
  rowTotals: Map<string, RowTotal>;
  colTotals: Map<string, RowTotal>;
  grandTotals: GrandTotal;
  cellMap: Map<string, DominanceCellDTO>;
  allCells: DominanceCellDTO[];
  activeBadge: Badge | null;
  onActiveBadgeChange: (b: Badge | null) => void;
  onSelectCell: (cell: DominanceCellDTO) => void;
  onDownloadPng: () => void;
  onSharePng: () => void;
  isDownloading: boolean;
  isSharing: boolean;
  isFetching: boolean;
  gridVisibleRef: React.RefObject<HTMLDivElement | null>;
  highlightedManagerKey?: string | null;
  isPremium: boolean;
  onUnlock?: () => void;
};

function computeBadgeCounts(cells: DominanceCellDTO[]): Record<Badge, number> {
  const counts = {} as Record<Badge, number>;
  for (const b of BADGES) counts[b] = 0;
  for (const c of cells) {
    if (c?.badge && counts[c.badge] !== undefined) counts[c.badge]++;
  }
  return counts;
}

export function DominanceGrid({
  managers,
  rowTotals,
  colTotals,
  grandTotals,
  cellMap,
  allCells,
  activeBadge,
  onActiveBadgeChange,
  onSelectCell,
  onDownloadPng,
  onSharePng,
  isDownloading,
  isSharing,
  isFetching,
  gridVisibleRef,
  highlightedManagerKey,
  isPremium,
  onUnlock,
}: Props) {
  const hasData = managers.length > 0;
  const badgeCounts = computeBadgeCounts(allCells);
  const hiddenRowCount = !isPremium ? Math.max(0, managers.length - FREE_ROW_COUNT) : 0;

  return (
    <div className="space-y-0">
      {hasData && (
        <GridToolbar
          onDownloadPng={onDownloadPng}
          onSharePng={onSharePng}
          isDownloading={isDownloading}
          isSharing={isSharing}
          hasData={hasData}
          isPremium={isPremium}
          onUnlock={onUnlock}
        />
      )}

      {isFetching ? (
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Finding roasts…
          </p>
          <GridSkeleton />
        </div>
      ) : hasData ? (
        <>
          <div
            ref={gridVisibleRef as React.RefObject<HTMLDivElement>}
            className="rounded-lg border bg-background"
            style={{ isolation: 'isolate' }}
          >
            <div 
              className="overflow-auto" 
              style={{ 
                WebkitOverflowScrolling: 'touch',
                maxHeight: isPremium ? 'calc(100vh - 300px)' : 'none',
                minHeight: isPremium ? '400px' : 'auto'
              }}
            >
              <GridTable
                managers={managers}
                rowTotals={rowTotals}
                colTotals={colTotals}
                grandTotals={grandTotals}
                cellMap={cellMap}
                forExport={false}
                activeBadge={activeBadge}
                onSelectCell={onSelectCell}
                highlightedManagerKey={highlightedManagerKey}
                isPremium={isPremium}
                freeRowCount={FREE_ROW_COUNT}
              />
            </div>
          </div>
          
          {/* Locked rows overlay for non-premium */}
          {!isPremium && hiddenRowCount > 0 && (
            <div className="relative mt-0 rounded-b-lg border border-t-0 bg-gradient-to-b from-muted/30 to-muted/60 overflow-hidden">
              {/* Blurred preview rows */}
              <div className="blur-sm opacity-50 pointer-events-none py-4 px-2">
                {managers.slice(FREE_ROW_COUNT, FREE_ROW_COUNT + 2).map((m, i) => (
                  <div key={m.key} className="flex items-center gap-4 py-2 border-b border-muted/20 last:border-0">
                    <div className="w-32 text-xs font-medium text-muted-foreground truncate">
                      #{FREE_ROW_COUNT + i + 1} {m.name}
                    </div>
                    <div className="flex-1 flex gap-2">
                      {Array.from({ length: Math.min(managers.length, 6) }).map((_, j) => (
                        <div key={j} className="w-16 h-8 bg-muted/40 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Lock overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Lock className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {hiddenRowCount} more manager{hiddenRowCount === 1 ? '' : 's'} hidden
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  See your matchups and every head-to-head record
                </p>
                <Button 
                  size="sm" 
                  onClick={onUnlock}
                  className="bg-primary hover:bg-primary/90"
                >
                  Unlock full grid — $2.99
                </Button>
              </div>
            </div>
          )}
          
          <LegendFooter
            activeBadge={activeBadge}
            onActiveBadgeChange={onActiveBadgeChange}
            badgeCounts={badgeCounts}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            No roasts found — try another week range.
          </p>
          <p className="text-xs text-muted-foreground">
            Choose &ldquo;Show Me The Roasts&rdquo; to see head-to-head dominance here.
          </p>
        </div>
      )}
    </div>
  );
}
