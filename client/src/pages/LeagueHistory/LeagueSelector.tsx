import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { getRecentLeagues, type RecentLeague } from "./utils";

type Props = {
  leagueId: string;
  startWeek: number;
  endWeek: number;
  onLeagueIdChange: (v: string) => void;
  onStartWeekChange: (v: number) => void;
  onEndWeekChange: (v: number) => void;
  onAnalyze: () => void;
  isFetching: boolean;
  error: Error | null;
  isCollapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  leagueName?: string | null;
  season?: string | null;
};

export function LeagueSelector({
  leagueId,
  startWeek,
  endWeek,
  onLeagueIdChange,
  onStartWeekChange,
  onEndWeekChange,
  onAnalyze,
  isFetching,
  error,
  isCollapsed,
  onCollapsedChange,
  leagueName,
  season,
}: Props) {
  const hasResult = Boolean(leagueName ?? season);
  const [recentLeagues, setRecentLeagues] = useState<RecentLeague[]>([]);
  const [selectedRecentValue, setSelectedRecentValue] = useState<string>("");

  useEffect(() => {
    setRecentLeagues(getRecentLeagues());
  }, []);

  function formatRecentLeagueLabel(r: RecentLeague): string {
    const name = r.leagueName ?? "League";
    const seasonStr = r.season ? `Season ${r.season}` : "";
    const weeksStr = `Weeks ${r.startWeek}–${r.endWeek}`;
    return [name, seasonStr, weeksStr].filter(Boolean).join(" • ");
  }

  function handleRecentLeagueSelect(value: string) {
    if (!value.startsWith("recent-")) return;
    const idx = Number(value.replace("recent-", ""));
    if (isNaN(idx) || idx < 0 || idx >= recentLeagues.length) return;
    const r = recentLeagues[idx];
    onLeagueIdChange(r.leagueId);
    onStartWeekChange(r.startWeek);
    onEndWeekChange(r.endWeek);
    // Reset selection
    setSelectedRecentValue("");
    // Trigger analysis after a brief delay to ensure state updates
    setTimeout(() => {
      onAnalyze();
    }, 50);
  }

  return (
    <Card className="p-4">
      <Collapsible
        open={!isCollapsed}
        onOpenChange={(open) => onCollapsedChange(!open)}
      >
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-left font-medium hover:opacity-80 transition-opacity"
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronUp className="h-4 w-4 shrink-0" />
              )}
              <span>
                {isCollapsed && hasResult
                  ? `${leagueName ?? "League"} • Season ${season ?? "—"} • Weeks ${startWeek}–${endWeek}`
                  : "League & week range"}
              </span>
            </button>
          </CollapsibleTrigger>
          {isCollapsed && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCollapsedChange(false);
              }}
            >
              Change
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="grid gap-3 md:grid-cols-4 mt-4">
            {recentLeagues.length > 0 && (
              <div className="md:col-span-4 space-y-1">
                <Label>Recent leagues</Label>
                <Select
                  value={selectedRecentValue}
                  onValueChange={handleRecentLeagueSelect}
                  disabled={isFetching}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a recent league..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recentLeagues.map((r, idx) => {
                      const key = `recent-${idx}`;
                      return (
                        <SelectItem key={key} value={key}>
                          {formatRecentLeagueLabel(r)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>League ID</Label>
              <Input
                value={leagueId}
                onChange={(e) => onLeagueIdChange(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Start week</Label>
              <Input
                inputMode="numeric"
                value={String(startWeek)}
                onChange={(e) =>
                  onStartWeekChange(Number(e.target.value || 1))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>End week</Label>
              <Input
                inputMode="numeric"
                value={String(endWeek)}
                onChange={(e) =>
                  onEndWeekChange(Number(e.target.value || 17))
                }
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={onAnalyze}
                disabled={isFetching || !leagueId.trim()}
              >
                {isFetching ? "Analyzing…" : "Analyze League"}
              </Button>
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-rose-600">{error.message}</p>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
