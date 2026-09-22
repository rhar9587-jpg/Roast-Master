import type { WeeklyResultRow } from "./weeklyCompactResults";

type Props = {
  week: number;
  results: WeeklyResultRow[];
};

/** Compact completed-week results — visually secondary to the roast hero. */
export function WeeklyCompactResults({ week, results }: Props) {
  if (!results.length) return null;

  return (
    <section
      className="space-y-2 max-w-3xl mx-auto w-full"
      aria-label={`Week ${week} results`}
      data-testid="weekly-compact-results"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Week {week} results
      </h3>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/10">
        {results.map((r) => (
          <li
            key={`${r.winnerName}-${r.loserName}-${r.winnerScore}`}
            className="grid grid-cols-[1fr_auto_1fr] gap-2 items-baseline px-3 py-2 text-sm"
          >
            <span className="font-semibold text-foreground truncate text-left">
              {r.winnerName}
            </span>
            <span className="tabular-nums font-bold text-primary whitespace-nowrap">
              {r.winnerScore.toFixed(1)} – {r.loserScore.toFixed(1)}
            </span>
            <span className="text-muted-foreground truncate text-right">
              {r.loserName}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
