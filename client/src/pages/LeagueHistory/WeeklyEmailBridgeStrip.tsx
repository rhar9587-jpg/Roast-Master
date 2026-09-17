import { Mail } from "lucide-react";

export type WeeklyEmailBridgeStripProps = {
  leagueWeek: number;
  leagueName?: string;
  emailMode: "recap" | "preview";
};

/**
 * Lightweight bridge between Weekly roast content and commissioner email tools.
 */
export function WeeklyEmailBridgeStrip({
  leagueWeek,
  leagueName,
  emailMode,
}: WeeklyEmailBridgeStripProps) {
  const modeLabel = emailMode === "recap" ? "Recap" : "Preview";
  const modeHint =
    emailMode === "recap"
      ? `Looking back at Week ${leagueWeek} — scores are in; email is the full week story.`
      : `Looking ahead at Week ${leagueWeek} — email is your matchup preview setup.`;

  return (
    <section
      className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 md:px-5 md:py-4 space-y-2 max-w-3xl mx-auto w-full"
      aria-label="This week's commissioner email"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Commissioner email
        </h3>
        <span className="text-[11px] font-medium uppercase tracking-wide rounded-full border border-border bg-background/80 px-2 py-0.5 text-muted-foreground">
          Week {leagueWeek} · {modeLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {leagueName ? (
          <>
            <span className="text-foreground/90">{leagueName}</span>
            {" — "}
          </>
        ) : null}
        {modeHint}
      </p>
      <ul className="text-xs text-foreground/90 list-disc list-inside space-y-0.5 pl-0.5">
        <li>Power rankings</li>
        <li>Matchups</li>
        <li>Intro aligned with this week&apos;s roast (headline + group chat drop)</li>
      </ul>
      <p className="text-xs pt-1">
        <a
          href="#weekly-commissioner-email"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Jump to email tools
        </a>
        <span className="text-muted-foreground">
          {" "}
          — preview in a new tab, or send to your commissioner.
        </span>
      </p>
    </section>
  );
}
