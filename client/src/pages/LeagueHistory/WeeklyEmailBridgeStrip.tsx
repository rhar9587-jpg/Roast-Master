import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/track";
import { weeklyHeadline, type WeeklyEmailMode } from "./weeklyContext";

export type WeeklyEmailBridgeStripProps = {
  leagueWeek: number;
  leagueName?: string;
  emailMode: WeeklyEmailMode;
};

/**
 * Primary CTA from Weekly roast → existing commissioner email section.
 */
export function WeeklyEmailBridgeStrip({
  leagueWeek,
  leagueName,
  emailMode,
}: WeeklyEmailBridgeStripProps) {
  const headline = weeklyHeadline(leagueWeek, emailMode);
  const readyLine =
    emailMode === "recap"
      ? `${headline} is ready.`
      : `${headline} setup is ready.`;

  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 md:px-5 md:py-5 max-w-3xl mx-auto w-full"
      aria-label="Commissioner tools"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Commissioner tools
          </h3>
          <p className="text-sm text-muted-foreground">
            {leagueName ? (
              <>
                <span className="text-foreground/90">{leagueName}</span>
                {" — "}
              </>
            ) : null}
            {readyLine}
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 font-semibold"
          onClick={() => {
            track("commissioner_cta_clicked", {
              week: leagueWeek,
              mode: emailMode,
            });
            const el = document.getElementById("weekly-commissioner-email");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Preview &amp; Send →
        </Button>
      </div>
    </section>
  );
}
