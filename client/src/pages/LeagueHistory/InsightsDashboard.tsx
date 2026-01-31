import { RoastDeckCarousel } from "@/components/roast/RoastDeckCarousel";
import { BaseballCard } from "@/components/roast/BaseballCard";
import { Button } from "@/components/ui/button";
import { fmtScore } from "./utils";
import type { LandlordSummary } from "./types";
import { Lock } from "lucide-react";
import { useState } from "react";
import * as React from "react";

// Personal Unlock Pricing
const PRICE = 7;

type MostOwned = {
  victimName: string;
  victimKey: string;
  timesOwned: number;
  totalGames: number;
  worstNemesisName: string;
  worstNemesisRecord: string;
  worstNemesisCellKey: string | null;
  cellKey: string | null;
  ownedBy: Array<{ cellKey: string }>;
};

type BiggestRivalry = {
  aKey: string;
  bKey: string;
  aName: string;
  bName: string;
  record: string;
  games: number;
  score: number;
  badge: string;
  cellKey: string;
};

type Props = {
  landlord: LandlordSummary | null;
  mostOwned: MostOwned | null;
  biggestRivalry: BiggestRivalry | null;
  avatarByKey: Record<string, string | null>;
  emojiByKey: Record<string, string | null>;
  onOpenCell: (cellKey: string | null) => void;
  isPremium: boolean;
  onUnlock?: () => void;
  lockedTotalCount?: number;
};

// Helper component to wrap blurred cards
function BlurredCardWrapper({ 
  children, 
  onUnlock 
}: { 
  children: React.ReactNode; 
  onUnlock?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className="relative">
      <div className="blur-sm opacity-60 pointer-events-none">
        {children}
      </div>
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.01] rounded-2xl"
        onClick={onUnlock}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="text-center">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          {isHovered && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                This is just the beginning…
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                Unlock to see who really owns this league
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InsightsDashboard({
  landlord,
  mostOwned,
  biggestRivalry,
  avatarByKey,
  emojiByKey,
  onOpenCell,
  isPremium,
  onUnlock,
  lockedTotalCount,
}: Props) {
  const landlordCard = (
    <BaseballCard
      badge="OWNED"
      title="THE LANDLORD 👑"
      name={landlord?.landlordName ?? "—"}
      avatarUrl={
        landlord ? (avatarByKey[landlord.landlordKey] ?? null) : null
      }
      emoji={
        landlord ? (emojiByKey[landlord.landlordKey] ?? null) : null
      }
      primaryStat={{
        value: landlord ? String(landlord.totalOwnedGames) : "—",
        label: "OWNED GAMES",
      }}
      punchline={
        landlord
          ? `Owns ${landlord.victimCount} managers. Rent is due.`
          : "No landlord yet"
      }
      lines={[
        { label: "Tenants", value: landlord ? String(landlord.victimCount) : "—" },
        {
          label: "Favorite Tenant",
          value: landlord?.bestVictim
            ? `${landlord.bestVictim.victimName} (${landlord.bestVictim.record})`
            : "—",
        },
      ]}
      back={{
        lines: landlord?.victims.map((v) => ({
          label: v.victimName,
          value: v.record,
        })) ?? [],
      }}
      season="2024–25"
      onClick={() =>
        onOpenCell(landlord?.bestVictim?.cellKey ?? null)
      }
      enableShare={true}
      isPremium={isPremium}
      roastContext={{
        victimName: landlord?.bestVictim?.victimName,
        landlordName: landlord?.landlordName,
      }}
    />
  );

  const mostOwnedCard = (
    <BaseballCard
      badge="NEMESIS"
      title="BIGGEST VICTIM 😭"
      name={mostOwned?.victimName ?? "—"}
      avatarUrl={
        mostOwned ? (avatarByKey[mostOwned.victimKey] ?? null) : null
      }
      emoji={
        mostOwned ? (emojiByKey[mostOwned.victimKey] ?? null) : null
      }
      primaryStat={{
        value: mostOwned ? String(mostOwned.timesOwned) : "—",
        label: "TIMES OWNED",
      }}
      punchline={
        mostOwned
          ? `Owned by ${mostOwned.timesOwned} managers. It's rough.`
          : "No victims yet"
      }
      lines={[
        { label: "Kryptonite", value: mostOwned?.worstNemesisName ?? "—" },
        { label: "Games", value: mostOwned ? String(mostOwned.totalGames) : "—" },
      ]}
      season="2024–25"
      onClick={() => onOpenCell(mostOwned?.cellKey ?? null)}
      enableShare={isPremium}
      isPremium={isPremium}
      roastContext={{
        victimName: mostOwned?.victimName,
        landlordName: mostOwned?.worstNemesisName,
      }}
    />
  );

  const biggestRivalryCard = (
    <BaseballCard
      badge="RIVAL"
      title="BIGGEST RIVALRY ⚔️"
      name={
        biggestRivalry
          ? `${biggestRivalry.aName} vs ${biggestRivalry.bName}`
          : "—"
      }
      avatarUrl={
        biggestRivalry
          ? (avatarByKey[biggestRivalry.aKey] ?? null)
          : null
      }
      emoji={
        biggestRivalry
          ? (emojiByKey[biggestRivalry.aKey] ?? null)
          : null
      }
      primaryStat={{
        value: biggestRivalry?.record ?? "—",
        label: "RECORD",
      }}
      punchline={
        biggestRivalry
          ? "These two hate each other."
          : "No rivalry yet"
      }
      lines={[
        {
          label: "Games",
          value: biggestRivalry ? String(biggestRivalry.games) : "—",
        },
        {
          label: "Score",
          value: biggestRivalry ? fmtScore(biggestRivalry.score) : "—",
        },
      ]}
      season="2024–25"
      onClick={() =>
        onOpenCell(biggestRivalry?.cellKey ?? null)
      }
      enableShare={isPremium}
      isPremium={isPremium}
      roastContext={{
        opponentName: biggestRivalry?.bName,
        record: biggestRivalry?.record,
      }}
    />
  );

  if (isPremium) {
    return (
      <RoastDeckCarousel>
        {landlordCard}
        {mostOwnedCard}
        {biggestRivalryCard}
      </RoastDeckCarousel>
    );
  }

  return (
    <div className="space-y-4">
      <RoastDeckCarousel>
        {landlordCard}
        <BlurredCardWrapper onUnlock={onUnlock}>
          {mostOwnedCard}
        </BlurredCardWrapper>
        <BlurredCardWrapper onUnlock={onUnlock}>
          {biggestRivalryCard}
        </BlurredCardWrapper>
      </RoastDeckCarousel>
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3 text-center">
        <p className="text-sm font-medium text-foreground">The full roast is waiting.</p>
        <ul className="text-xs text-muted-foreground space-y-1 text-left max-w-xs mx-auto">
          <li>• All hero cards (Biggest Victim, Playoff Choker, and more)</li>
          <li>• League storylines and personal roasts</li>
          <li>• Weekly roasts for every matchup</li>
          <li>• Season Wrapped for each manager</li>
          <li>• End-of-season recap</li>
        </ul>
        <Button size="sm" onClick={onUnlock}>
          Unlock for you — ${PRICE}
        </Button>
      </div>
    </div>
  );
}
