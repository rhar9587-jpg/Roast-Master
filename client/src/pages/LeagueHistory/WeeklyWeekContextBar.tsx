import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WeeklyEmailMode = "recap" | "preview";

export type WeeklyWeekContextBarProps = {
  mode: WeeklyEmailMode;
  leagueWeek: number;
  recapWeek: number;
  previewWeek: number;
  disabled?: boolean;
  onModeChange: (mode: WeeklyEmailMode) => void;
  onWeekOverride: (week: number) => void;
};

/**
 * Master week/mode control for the Weekly tab.
 * Mode switch re-applies smart NFL defaults; manual week edit is an override.
 */
export function WeeklyWeekContextBar({
  mode,
  leagueWeek,
  recapWeek,
  previewWeek,
  disabled = false,
  onModeChange,
  onWeekOverride,
}: WeeklyWeekContextBarProps) {
  const modeLabel = mode === "recap" ? "Recap" : "Preview";
  const helper =
    mode === "recap"
      ? `Recap looks back at Week ${leagueWeek} (scores in).`
      : `Preview looks ahead at Week ${leagueWeek} (upcoming slate).`;

  return (
    <section
      className="rounded-lg border bg-muted/20 p-4 space-y-3"
      aria-label="Week context"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Week context</h3>
        <span className="text-[11px] font-medium uppercase tracking-wide rounded-full border border-border bg-background/80 px-2 py-0.5 text-muted-foreground">
          Week {leagueWeek} · {modeLabel}
        </span>
      </div>

      <div
        className="inline-flex rounded-lg border bg-background p-0.5 gap-0.5"
        role="group"
        aria-label="Email type"
      >
        <Button
          type="button"
          size="sm"
          variant={mode === "recap" ? "default" : "ghost"}
          className={cn("h-8", mode === "recap" && "shadow-sm")}
          disabled={disabled}
          onClick={() => onModeChange("recap")}
        >
          Last week (Recap)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "preview" ? "default" : "ghost"}
          className={cn("h-8", mode === "preview" && "shadow-sm")}
          disabled={disabled}
          onClick={() => onModeChange("preview")}
        >
          This week (Preview)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{helper}</p>
      <p className="text-[11px] text-muted-foreground">
        Defaults: Recap → Week {recapWeek}, Preview → Week {previewWeek}. Change week below to override.
      </p>

      <div className="max-w-[10rem]">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="weekly-week-override">
          Change week
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
            onWeekOverride(Math.min(18, Math.max(1, next)));
          }}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>
    </section>
  );
}
