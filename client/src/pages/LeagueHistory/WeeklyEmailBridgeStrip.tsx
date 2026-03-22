import { Mail } from "lucide-react";

export type WeeklyEmailBridgeStripProps = {
  leagueWeek: number;
  leagueName?: string;
  emailMode: "recap" | "preview";
};

/**
 * Lightweight bridge between Weekly roast content and commissioner email tools:
 * same week, recap vs preview, what ships in the email — no iframe, no duplicate week picker.
 */
export function WeeklyEmailBridgeStrip({
  leagueWeek,
  leagueName,
  emailMode,
}: WeeklyEmailBridgeStripProps) {
  const modeLabel =
    emailMode === "recap" ? "Recap (post-week)" : "Preview (pre-week)";
  const modeHint =
    emailMode === "recap"
      ? "Scores are in — full week story in the email."
      : "Before the week kicks off — roast uses last available scores; email is your lookahead setup.";

  return (
    <section
      className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 md:px-5 md:py-4 space-y-2 max-w-3xl mx-auto w-full"
      aria-label="This week's commissioner email"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          This week&apos;s email
        </h3>
        <span className="text-[11px] font-medium uppercase tracking-wide rounded-full border border-border bg-background/80 px-2 py-0.5 text-muted-foreground">
          {modeLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Week <span className="font-semibold text-foreground">{leagueWeek}</span>
        {leagueName ? (
          <>
            {" "}
            · <span className="text-foreground/90">{leagueName}</span>
          </>
        ) : null}{" "}
        — same week powers the roast above and the commissioner email below.
      </p>
      <p className="text-xs text-muted-foreground">{modeHint}</p>
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
          — generate, preview in a new tab, or send to your commissioner.
        </span>
      </p>
    </section>
  );
}
