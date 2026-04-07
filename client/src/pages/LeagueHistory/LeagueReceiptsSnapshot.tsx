import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/track";
import type { LandlordSummary } from "./types";

type MostOwnedSnap = {
  victimName: string;
  timesOwned: number;
  worstNemesisName: string;
};

type RivalrySnap = {
  aName: string;
  bName: string;
  record: string;
};

export type LeagueReceiptsSnapshotProps = {
  leagueId: string;
  leagueName: string;
  landlord: LandlordSummary | null;
  mostOwned: MostOwnedSnap | null;
  biggestRivalry: RivalrySnap | null;
  /** Optional fourth line, e.g. first hero receipt headline */
  bonusRoastLine?: string | null;
};

export function buildLeagueRoastClipboardText(p: LeagueReceiptsSnapshotProps): string {
  const lines: string[] = ["🔥 Fantasy Roast 🔥", ""];

  if (p.landlord) {
    lines.push(
      `${p.landlord.landlordName} owns ${p.landlord.victimCount} manager${p.landlord.victimCount === 1 ? "" : "s"}. Rent is due.`,
      "",
    );
  }

  if (p.mostOwned) {
    lines.push(`Biggest victim: ${p.mostOwned.victimName}`, "");
  }

  if (p.biggestRivalry) {
    lines.push(`Rivalry: ${p.biggestRivalry.aName} vs ${p.biggestRivalry.bName}`, "");
  }

  if (p.bonusRoastLine?.trim()) {
    lines.push(p.bonusRoastLine.trim(), "");
  }

  lines.push("Get yours: fantasyroast.net");
  return lines.join("\n");
}

export function LeagueReceiptsSnapshot({
  leagueId,
  leagueName,
  landlord,
  mostOwned,
  biggestRivalry,
  bonusRoastLine,
}: LeagueReceiptsSnapshotProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const hasAny = landlord || mostOwned || biggestRivalry || bonusRoastLine?.trim();
  if (!hasAny) return null;

  async function copyLeagueRoast() {
    const text = buildLeagueRoastClipboardText({
      leagueId,
      leagueName,
      landlord,
      mostOwned,
      biggestRivalry,
      bonusRoastLine,
    });
    try {
      await navigator.clipboard.writeText(text);
      track("league_roast_copied", { league_id: leagueId });
      setCopied(true);
      toast({ title: "Copied — drop it in the group chat." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }

  return (
    <section
      className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-muted/30 p-4 md:p-5 space-y-4"
      aria-label="League roast snapshot"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            League roast snapshot
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leagueName ? `${leagueName} — ` : null}the receipts in one glance.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 font-semibold interact-cta"
          onClick={copyLeagueRoast}
        >
          {copied ? "Copied" : "🔥 Copy league roast"}
        </Button>
      </div>

      <ul className="space-y-2 text-sm text-foreground">
        {landlord && (
          <li>
            <span className="font-semibold text-primary">League landlord: </span>
            {landlord.landlordName} — owns {landlord.victimCount} manager
            {landlord.victimCount === 1 ? "" : "s"} head-to-head.
          </li>
        )}
        {mostOwned && (
          <li>
            <span className="font-semibold text-primary">Biggest victim: </span>
            {mostOwned.victimName} — owned in {mostOwned.timesOwned} different head-to-head
            {mostOwned.timesOwned === 1 ? "" : "s"} ({mostOwned.worstNemesisName}&apos;s favorite
            punching bag).
          </li>
        )}
        {biggestRivalry && (
          <li>
            <span className="font-semibold text-primary">Strongest rivalry: </span>
            {biggestRivalry.aName} vs {biggestRivalry.bName} ({biggestRivalry.record}).
          </li>
        )}
        {bonusRoastLine?.trim() && (
          <li>
            <span className="font-semibold text-primary">Also: </span>
            {bonusRoastLine.trim()}
          </li>
        )}
      </ul>
    </section>
  );
}
