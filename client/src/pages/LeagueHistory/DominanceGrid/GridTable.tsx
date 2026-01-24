import { Fragment } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { abbrev, fmtRecord, fmtScore } from "../utils";
import { GridCell } from "./GridCell";
import type { Badge, DominanceCellDTO, ManagerRow, RowTotal, GrandTotal } from "../types";

type Props = {
  managers: ManagerRow[];
  rowTotals: Map<string, RowTotal>;
  colTotals: Map<string, RowTotal>;
  grandTotals: GrandTotal;
  cellMap: Map<string, DominanceCellDTO>;
  forExport: boolean;
  activeBadge: Badge | null;
  onSelectCell: (cell: DominanceCellDTO) => void;
};

const SCORE_TOOLTIP = "Win rate differential (-1 to +1)";
const LEAGUE_VS_TEAM_TOOLTIP =
  "Combined record of all managers vs this team";
const GRAND_TOOLTIP = "Total matchups (each appears twice)";

export function GridTable({
  managers,
  rowTotals,
  colTotals,
  grandTotals,
  cellMap,
  forExport,
  activeBadge,
  onSelectCell,
}: Props) {
  const applyFilter = !forExport && activeBadge != null;
  const suffix = forExport ? "x" : "v";

  return (
    <div
      className="grid gap-px"
      style={{
        gridTemplateColumns: `minmax(140px, 180px) repeat(${managers.length}, minmax(90px, 1fr)) minmax(120px, 160px)`,
      }}
    >
      <div className="sticky top-0 left-0 z-40 bg-background border-b border-r border-muted/30 p-2 text-xs font-medium shadow-sm" style={{ transform: 'translateZ(0)' }}>
        Team
      </div>

      {managers.map((m) => (
        <div
          key={`col-${m.key}-${suffix}`}
          className="sticky top-0 z-30 bg-background border-b p-2 text-xs font-medium text-center shadow-sm"
          style={{ transform: 'translateZ(0)' }}
          title={m.name}
        >
          {abbrev(m.name)}
        </div>
      ))}

      <div className="sticky top-0 z-30 bg-background border-b border-l border-muted/30 p-2 text-xs font-medium text-center shadow-sm" style={{ transform: 'translateZ(0)' }}>
        Total
      </div>

      {managers.map((row) => {
        const rt = rowTotals.get(row.key);

        return (
          <Fragment key={`r-${row.key}-${suffix}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="sticky left-0 z-20 bg-background border-r border-muted/30 p-2 shadow-sm" style={{ transform: 'translateZ(0)' }}>
                  <div className="text-xs font-medium truncate">{abbrev(row.name)}</div>
                  {rt ? (
                    <div className="text-[11px] text-muted-foreground">
                      {fmtRecord(rt.w, rt.l, rt.t)} • {fmtScore(rt.score)}
                    </div>
                  ) : null}
                </div>
              </TooltipTrigger>
              <TooltipContent className="!bg-background">{row.name}</TooltipContent>
            </Tooltip>

            {managers.map((col) => {
              if (row.key === col.key) {
                return (
                  <div
                    key={`cell-${row.key}-${col.key}-${suffix}`}
                    className="p-2 bg-muted/10"
                  />
                );
              }

              const c = cellMap.get(`${row.key}-${col.key}`);
              if (!c) {
                return (
                  <div
                    key={`cell-${row.key}-${col.key}-${suffix}`}
                    className="p-2 text-xs text-muted-foreground"
                  >
                    —
                  </div>
                );
              }

              return (
                <GridCell
                  key={`cell-${c.a}-${c.b}-${suffix}`}
                  cell={c}
                  forExport={forExport}
                  applyFilter={applyFilter}
                  filterBadge={activeBadge}
                  onSelect={() => onSelectCell(c)}
                />
              );
            })}

            <div className="border-l border-muted/30 p-2 bg-muted/20">
              {rt ? (
                <div className="space-y-1">
                  <div className="text-xs font-medium">Overall</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtRecord(rt.w, rt.l, rt.t)}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-sm font-semibold cursor-help">
                        {fmtScore(rt.score)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="!bg-background">{SCORE_TOOLTIP}</TooltipContent>
                  </Tooltip>
                  <div className="text-[10px] text-muted-foreground">
                    {rt.games} games
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          </Fragment>
        );
      })}

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="sticky left-0 z-20 bg-background border-t border-r border-muted/30 p-2 cursor-help shadow-sm" style={{ transform: 'translateZ(0)' }}>
            <div className="text-xs font-medium">League vs Team</div>
            <div className="text-[11px] text-muted-foreground">
              (how everyone does vs them)
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="!bg-background">{LEAGUE_VS_TEAM_TOOLTIP}</TooltipContent>
      </Tooltip>

      {managers.map((m) => {
        const ct = colTotals.get(m.key);
        return (
          <div
            key={`coltotal-${m.key}-${suffix}`}
            className="p-2 text-center bg-muted/10"
          >
            {ct ? (
              <>
                <div className="text-xs text-muted-foreground">
                  {fmtRecord(ct.w, ct.l, ct.t)}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-sm font-semibold cursor-help">
                      {fmtScore(ct.score)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="!bg-background">{SCORE_TOOLTIP}</TooltipContent>
                </Tooltip>
                <div className="text-[10px] text-muted-foreground">
                  {ct.games} games
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
          </div>
        );
      })}

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="border-l border-muted/30 p-2 text-center bg-muted/20 cursor-help">
            <div className="text-xs font-medium">Grand</div>
            <div className="text-xs text-muted-foreground">
              {fmtRecord(grandTotals.w, grandTotals.l, grandTotals.t)}
            </div>
            <div className="text-sm font-semibold">
              {fmtScore(grandTotals.score)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              (double-counted)
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="!bg-background">{GRAND_TOOLTIP}</TooltipContent>
      </Tooltip>
    </div>
  );
}
