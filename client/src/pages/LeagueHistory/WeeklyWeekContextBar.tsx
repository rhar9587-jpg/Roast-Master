import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  clampWeek,
  navigateWeeklyWeek,
  weeklyHeadline,
  weeklyModeLabel,
  weeklyPresentationHeadline,
  type WeeklyEmailMode,
  type WeeklyWeekPresentation,
} from "./weeklyContext";

export type { WeeklyEmailMode };

export type WeeklyWeekContextBarProps = {
  mode: WeeklyEmailMode;
  leagueWeek: number;
  disabled?: boolean;
  presentation?: WeeklyWeekPresentation;
  onModeChange: (mode: WeeklyEmailMode) => void;
  onWeekOverride: (week: number) => void;
};

/**
 * Compact week/mode control for the Weekly tab.
 * Prominent: slate-aware "Week 8 Recap/Live/Upcoming". Compact: prev/next + Recap/Preview.
 * Manual week entry is secondary behind "Choose another week".
 */
export function WeeklyWeekContextBar({
  mode,
  leagueWeek,
  disabled = false,
  presentation,
  onModeChange,
  onWeekOverride,
}: WeeklyWeekContextBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const modeLabel = presentation
    ? presentation.label
    : weeklyModeLabel(mode);
  const canPrev = leagueWeek > 1;
  const canNext = leagueWeek < 18;
  const title = presentation
    ? weeklyPresentationHeadline(leagueWeek, presentation)
    : weeklyHeadline(leagueWeek, mode);
  const supportingLine =
    presentation?.supportingLine ??
    (mode === "recap" ? "Here's what happened." : "Here's what's coming.");

  return (
    <section className="space-y-3" aria-label="Week context">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            This week
          </p>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none mt-1">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">{supportingLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center rounded-lg border bg-background">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-r-none"
              disabled={disabled || !canPrev}
              aria-label="Previous week"
              onClick={() => onWeekOverride(navigateWeeklyWeek(leagueWeek, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-semibold tabular-nums text-muted-foreground min-w-[4.5rem] text-center">
              Wk {leagueWeek}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-l-none"
              disabled={disabled || !canNext}
              aria-label="Next week"
              onClick={() => onWeekOverride(navigateWeeklyWeek(leagueWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="inline-flex rounded-lg border bg-background p-0.5 gap-0.5"
            role="group"
            aria-label="Recap or Upcoming"
          >
            <Button
              type="button"
              size="sm"
              variant={mode === "recap" ? "default" : "ghost"}
              className={cn("h-8 px-3", mode === "recap" && "shadow-sm")}
              disabled={disabled}
              onClick={() => onModeChange("recap")}
            >
              Recap
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "preview" ? "default" : "ghost"}
              className={cn("h-8 px-3", mode === "preview" && "shadow-sm")}
              disabled={disabled}
              onClick={() => onModeChange("preview")}
            >
              Upcoming
            </Button>
          </div>
        </div>
      </div>

      <Collapsible open={pickerOpen} onOpenChange={setPickerOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Choose another week
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", pickerOpen && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="max-w-[10rem]">
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="weekly-week-override"
            >
              Week number
            </label>
            <input
              id="weekly-week-override"
              type="number"
              min={1}
              max={18}
              value={leagueWeek}
              disabled={disabled}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                onWeekOverride(clampWeek(next));
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Showing {modeLabel} for Week {leagueWeek}.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
