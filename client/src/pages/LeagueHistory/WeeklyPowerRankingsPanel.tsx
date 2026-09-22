import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatRankMovementLabel,
  rankMovementVisible,
  type RankMovementState,
} from "@shared/rankMovement";

export type WeeklyPowerRankingRow = {
  rank: number;
  teamName: string;
  record: string;
  trend?: "up" | "down" | "flat";
  placesMoved?: number | null;
  showMovement?: boolean;
  previousRank?: number | null;
};

type ApiResponse = {
  leagueName?: string;
  week?: number;
  rankings?: Array<{
    rank: number;
    teamName: string;
    record: string;
    trend?: "up" | "down" | "flat";
    placesMoved?: number | null;
    showMovement?: boolean;
    previousRank?: number | null;
  }>;
};

export const WEEKLY_POWER_RANKINGS_MOBILE_DEFAULT = 5;

export function weeklyPowerRankingsVisibleCount(opts: {
  total: number;
  expanded: boolean;
  /** When true (mobile / narrow), default to Top 5. */
  compactDefault: boolean;
  compactLimit?: number;
}): number {
  if (opts.expanded || !opts.compactDefault) return opts.total;
  const limit = opts.compactLimit ?? WEEKLY_POWER_RANKINGS_MOBILE_DEFAULT;
  return Math.min(opts.total, limit);
}

/** @deprecated Prefer row.showMovement + formatRankMovementLabel */
export function rankingShowsMovement(
  row: Pick<WeeklyPowerRankingRow, "trend" | "showMovement">,
  hasPriorHistory: boolean,
): boolean {
  if (row.showMovement === true) return true;
  if (row.showMovement === false) return false;
  if (!hasPriorHistory) return false;
  return row.trend === "up" || row.trend === "down";
}

export function weeklyRankMovementLabel(row: WeeklyPowerRankingRow): string {
  if (row.showMovement !== true) return "";
  const state: RankMovementState =
    row.trend === "up" ? "up" : row.trend === "down" ? "down" : "same";
  return formatRankMovementLabel({
    state,
    places: row.placesMoved ?? (state === "same" ? 0 : null),
  });
}

type Props = {
  leagueId: string;
  week: number;
  /** Only render for completed/final weeks. */
  enabled: boolean;
};

export function WeeklyPowerRankingsPanel({ leagueId, week, enabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = leagueId.trim();

  const { data, isError, isLoading } = useQuery({
    queryKey: ["weekly-power-rankings", trimmed, week],
    queryFn: async (): Promise<ApiResponse> => {
      const res = await fetch(
        `/api/power-rankings?league_id=${encodeURIComponent(trimmed)}&week=${week}`,
      );
      if (!res.ok) throw new Error("rankings unavailable");
      return res.json();
    },
    enabled: enabled && !!trimmed && week >= 1,
    staleTime: 60_000,
    retry: false,
  });

  const rankings: WeeklyPowerRankingRow[] = useMemo(() => {
    if (!data?.rankings?.length) return [];
    return data.rankings.map((r) => ({
      rank: r.rank,
      teamName: r.teamName,
      record: r.record,
      ...(r.trend ? { trend: r.trend } : {}),
      placesMoved: r.placesMoved ?? null,
      showMovement: r.showMovement === true,
      ...(r.previousRank != null ? { previousRank: r.previousRank } : {}),
    }));
  }, [data]);

  useEffect(() => {
    setExpanded(false);
  }, [trimmed, week]);

  if (!enabled || isError || isLoading || !rankings.length) return null;

  const compactDefault = true;
  const visible = weeklyPowerRankingsVisibleCount({
    total: rankings.length,
    expanded,
    compactDefault,
  });
  const shown = rankings.slice(0, visible);
  const canExpand = compactDefault && rankings.length > visible;

  return (
    <section
      className="space-y-2 max-w-3xl mx-auto w-full"
      aria-label="Power Rankings"
      data-testid="weekly-power-rankings"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Power Rankings
      </h3>
      <ol className="rounded-lg border border-border/70 bg-muted/10 divide-y divide-border/60">
        {shown.map((r) => {
          const label = weeklyRankMovementLabel(r);
          const show = Boolean(label) && rankMovementVisible({
            state: r.showMovement !== true ? "none" : r.trend === "up" ? "up" : r.trend === "down" ? "down" : "same",
          });
          return (
            <li
              key={`${r.rank}-${r.teamName}`}
              className="grid grid-cols-[1.75rem_1fr_auto] gap-2 items-baseline px-3 py-2 text-sm"
              data-testid="weekly-power-rank-row"
            >
              <span className="tabular-nums text-muted-foreground font-semibold">
                {r.rank}
              </span>
              <span className="font-semibold text-foreground truncate">
                {r.teamName}
                {show ? (
                  <span
                    className={cn(
                      "ml-1.5 text-xs tabular-nums",
                      r.trend === "up"
                        ? "text-emerald-500"
                        : r.trend === "down"
                          ? "text-rose-400"
                          : "text-muted-foreground",
                    )}
                    aria-label={label}
                  >
                    {label}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground text-xs">
                {r.record}
              </span>
            </li>
          );
        })}
      </ol>
      {canExpand || (expanded && compactDefault) ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          data-testid="weekly-power-rankings-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show top 5" : "Show full rankings"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
          />
        </button>
      ) : null}
    </section>
  );
}
