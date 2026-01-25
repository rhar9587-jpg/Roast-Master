import { GridToolbar } from "./GridToolbar";
import { GridTable } from "./GridTable";
import { GridSkeleton } from "./GridSkeleton";
import { LegendFooter } from "./LegendFooter";
import { BADGES } from "../utils";
import type {
  Badge,
  ManagerRow,
  RowTotal,
  GrandTotal,
  DominanceCellDTO,
} from "../types";

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
}: Props) {
  const hasData = managers.length > 0;
  const badgeCounts = computeBadgeCounts(allCells);

  return (
    <div className="space-y-0">
      {hasData && (
        <GridToolbar
          onDownloadPng={onDownloadPng}
          onSharePng={onSharePng}
          isDownloading={isDownloading}
          isSharing={isSharing}
          hasData={hasData}
        />
      )}

      {isFetching ? (
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Finding receipts…
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
                maxHeight: 'calc(100vh - 300px)',
                minHeight: '400px'
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
              />
            </div>
          </div>
          <LegendFooter
            activeBadge={activeBadge}
            onActiveBadgeChange={onActiveBadgeChange}
            badgeCounts={badgeCounts}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            No receipts found — try another week range.
          </p>
          <p className="text-xs text-muted-foreground">
            Choose &ldquo;Show Me The Receipts&rdquo; to see head-to-head dominance here.
          </p>
        </div>
      )}
    </div>
  );
}
