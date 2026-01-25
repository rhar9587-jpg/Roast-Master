import { BADGES, badgePill, getBadgeDisplayName } from "../utils";
import type { Badge } from "../types";

const BADGE_EXPLANATIONS: Record<Badge, string> = {
  OWNED: "You own them.",
  NEMESIS: "They own you.",
  RIVAL: "This one's personal.",
  EDGE: "Slight edge.",
  "SMALL SAMPLE": "Not enough receipts yet.",
};

type Props = {
  activeBadge: Badge | null;
  onActiveBadgeChange: (b: Badge | null) => void;
  badgeCounts: Record<Badge, number>;
};

export function LegendFooter({
  activeBadge,
  onActiveBadgeChange,
  badgeCounts,
}: Props) {
  return (
    <footer className="mt-4 space-y-2 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">
        Find my receipts
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {BADGES.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() =>
              onActiveBadgeChange(activeBadge === b ? null : b)
            }
            className={`rounded px-2 py-1 text-xs transition-all duration-200 ${badgePill(
              b
            )} ${
              activeBadge === b
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "hover:opacity-90"
            }`}
            title={BADGE_EXPLANATIONS[b]}
          >
            {getBadgeDisplayName(b)} ({badgeCounts[b] ?? 0})
          </button>
        ))}
        {activeBadge ? (
          <button
            type="button"
            onClick={() => onActiveBadgeChange(null)}
            className="text-primary text-xs underline hover:no-underline"
          >
            Show all matchups
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {BADGES.map((b) => (
          <span key={b}>
            <span className={badgePill(b) + " rounded px-1 py-0.5"}>
              {getBadgeDisplayName(b)}
            </span>{" "}
            = {BADGE_EXPLANATIONS[b]}
          </span>
        ))}
      </div>
    </footer>
  );
}
