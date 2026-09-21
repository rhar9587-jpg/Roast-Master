import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/track";
import {
  weeklyCommissionerBridgeLine,
  type WeeklyEmailMode,
  type WeeklyWeekPresentation,
} from "./weeklyContext";
import { EMAIL_TOOLS_LABEL } from "./shareHierarchyLabels";

export type WeeklyEmailBridgeStripProps = {
  leagueWeek: number;
  leagueName?: string;
  emailMode: WeeklyEmailMode;
  presentation: WeeklyWeekPresentation;
};

/**
 * Secondary CTA from Weekly roast → Email tools section.
 */
export function WeeklyEmailBridgeStrip({
  leagueWeek,
  leagueName,
  emailMode,
  presentation,
}: WeeklyEmailBridgeStripProps) {
  const readyLine = weeklyCommissionerBridgeLine({
    week: leagueWeek,
    mode: emailMode,
    presentation,
  });

  return (
    <section
      className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 md:px-5 md:py-4 max-w-3xl mx-auto w-full"
      aria-label={EMAIL_TOOLS_LABEL}
      data-testid="email-tools-bridge"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {EMAIL_TOOLS_LABEL}
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
          variant="outline"
          className="shrink-0 font-semibold"
          data-testid="open-email-tools"
          onClick={() => {
            track("commissioner_cta_clicked", {
              week: leagueWeek,
              mode: emailMode,
              recap_ready: presentation.recapReady,
            });
            const el = document.getElementById("weekly-commissioner-email");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
            // Expand Email tools when jumping from the bridge
            const trigger = el?.querySelector(
              '[data-testid="email-tools-trigger"]',
            ) as HTMLButtonElement | null;
            if (trigger && trigger.getAttribute("data-state") !== "open") {
              trigger.click();
            }
          }}
        >
          {EMAIL_TOOLS_LABEL} →
        </Button>
      </div>
    </section>
  );
}
