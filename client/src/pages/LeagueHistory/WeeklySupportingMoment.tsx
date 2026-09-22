/**
 * Compact supporting roast moment for the Weekly tab.
 * Hero stays a full WrappedCard; supporting moments are editorial secondary stories.
 * Full poster + Share this card / Save image reveal on expand (preserves share graphics).
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Card, RoastResponse } from "@shared/schema";
import { SHARE_FOOTER } from "@/lib/brand";
import { WrappedCard } from "@/components/WrappedCard";
import { mapEngineCardToVisual } from "./weeklyShareCards";
import { SHARE_THIS_CARD_LABEL } from "./shareHierarchyLabels";
import { cn } from "@/lib/utils";

type Props = {
  card: Card;
  week: number;
  data: Pick<RoastResponse, "stats">;
  isPremium: boolean;
};

export function WeeklySupportingMoment({ card, week, data, isPremium }: Props) {
  const [posterOpen, setPosterOpen] = useState(false);
  const visual = mapEngineCardToVisual(card, week, data);
  const category = visual.kicker;
  const subject =
    visual.isMatchup && visual.matchupData
      ? visual.matchupData.teamA
      : visual.title;
  const punchline = visual.tagline || visual.subtitle || "";
  const stat = visual.bigValue
    ? `${visual.bigValue}${visual.statLabel ? ` ${visual.statLabel}` : ""}`.trim()
    : card.stat
      ? String(card.stat)
      : undefined;

  return (
    <div
      className="rounded-lg border border-border/70 bg-muted/10"
      data-testid="weekly-supporting-roast"
      data-presentation="compact"
      data-card-type={card.type}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {category}
          </p>
          <p className="text-sm font-bold text-foreground leading-snug truncate">{subject}</p>
          {stat ? (
            <p className="text-sm font-semibold tabular-nums text-primary">{stat}</p>
          ) : null}
          {punchline ? (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              {punchline}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1.5",
            "text-[11px] font-semibold text-foreground hover:bg-muted/60",
          )}
          aria-expanded={posterOpen}
          data-testid="weekly-supporting-expand-share"
          onClick={() => setPosterOpen((o) => !o)}
        >
          {posterOpen ? "Hide card" : SHARE_THIS_CARD_LABEL}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", posterOpen ? "rotate-180" : "")}
          />
        </button>
      </div>

      {posterOpen ? (
        <div className="border-t border-border/60 px-2 pb-3 pt-2" data-testid="weekly-supporting-full-card">
          <WrappedCard
            kicker={visual.kicker}
            kickerIcon={null}
            title={visual.title}
            subtitle={visual.subtitle}
            {...(visual.bigValue
              ? { bigValue: visual.bigValue, statLabel: visual.statLabel ?? "Stat" }
              : {})}
            tagline={visual.tagline}
            footer={SHARE_FOOTER}
            accent={visual.accent}
            isMatchup={visual.isMatchup}
            matchupData={visual.matchupData}
            isPremium={isPremium}
          />
        </div>
      ) : null}
    </div>
  );
}
