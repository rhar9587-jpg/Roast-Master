import { RoastDeckCarousel } from "@/components/roast/RoastDeckCarousel";
import { BaseballCard } from "@/components/roast/BaseballCard";
import { Button } from "@/components/ui/button";
import { fmtScore } from "./utils";
import type { LandlordSummary } from "./types";
import { Lock } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import type { PersonalHookCard } from "./computePersonalHookCard";

// Personal Unlock Pricing
const PRICE = 2.99;

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

type NflDoppelganger = {
  team: string;
  label: string;
  reasons: string[];
  roastLine: string;
  record: string;
  season: string;
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
  personalHookCard?: PersonalHookCard | null;
  nflDoppelganger?: NflDoppelganger | null;
  viewerName?: string;
  viewerAvatarUrl?: string | null;
  viewerEmoji?: string | null;
};

// Helper component to wrap blurred cards
function BlurredCardWrapper({
  children,
  onUnlock,
}: {
  children: React.ReactNode;
  onUnlock?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <div className="blur-sm opacity-60 pointer-events-none">{children}</div>
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
              <p className="text-xs font-medium text-muted-foreground">This is just the beginning…</p>
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
  personalHookCard,
  nflDoppelganger,
  viewerName,
  viewerAvatarUrl,
  viewerEmoji,
}: Props) {
  const nflDoppelgangerCard = nflDoppelganger ? (
    <BaseballCard
      badge="EDGE"
      badgeText={nflDoppelganger.label.toUpperCase()}
      title="NFL DOPPELGÄNGER 🏈"
      name={nflDoppelganger.team}
      avatarUrl={viewerAvatarUrl ?? null}
      emoji={viewerEmoji ?? null}
      primaryStat={{
        value: nflDoppelganger.record,
        label: "YOUR RECORD",
      }}
      punchline={nflDoppelganger.roastLine}
      lines={[
        { label: "Archetype", value: nflDoppelganger.label },
        { label: "Season", value: nflDoppelganger.season },
      ]}
      back={{
        lines: nflDoppelganger.reasons.map((reason, i) => ({
          label: `${i + 1}.`,
          value: reason,
        })),
      }}
      season={nflDoppelganger.season}
      enableShare={isPremium}
      isPremium={isPremium}
    />
  ) : null;

  const personalHookBaseballCard = personalHookCard ? (
    <BaseballCard
      badge="EDGE"
      badgeText={
        personalHookCard.type === "undefeated"
          ? personalHookCard.scope === "partial"
            ? "UNBEATEN"
            : "UNTOUCHABLE"
          : personalHookCard.type === "second_most_points_loss"
            ? "ROBBED"
            : "PAIN"
      }
      title={
        personalHookCard.type === "undefeated"
          ? personalHookCard.scope === "partial"
            ? "UNBEATEN IN RANGE"
            : "UNDEFEATED 🏆"
          : personalHookCard.type === "second_most_points_loss"
            ? "ROBBED 😤"
            : "YOUR WORST LOSS 💀"
      }
      name={viewerName ?? "You"}
      avatarUrl={viewerAvatarUrl ?? null}
      emoji={viewerEmoji ?? null}
      primaryStat={
        personalHookCard.type === "undefeated"
          ? {
              value: personalHookCard.record ?? `${personalHookCard.wins ?? 0}–${personalHookCard.losses ?? 0}`,
              label: personalHookCard.scope === "partial" ? "IN RANGE" : "RECORD",
            }
          : personalHookCard.pointsFor
            ? {
                value: personalHookCard.pointsFor,
                label: `WEEK ${personalHookCard.week}`,
              }
            : { value: "—", label: "—" }
      }
      punchline={personalHookCard.body}
      lines={
        personalHookCard.type !== "undefeated"
          ? [
              { label: "Week", value: String(personalHookCard.week) },
              { label: "Points", value: personalHookCard.pointsFor },
            ]
          : [
              { label: "Record", value: personalHookCard.record ?? `${personalHookCard.wins ?? 0}–0` },
              { label: "Losses", value: String(personalHookCard.losses ?? 0) },
            ]
      }
      season={personalHookCard.season ?? "2024–25"}
      enableShare={isPremium}
      isPremium={isPremium}
    />
  ) : null;

  const landlordCard = landlord ? (
    <BaseballCard
      badge="OWNED"
      title="THE LANDLORD 👑"
      name={landlord.landlordName}
      avatarUrl={avatarByKey[landlord.landlordKey] ?? null}
      emoji={emojiByKey[landlord.landlordKey] ?? null}
      primaryStat={{
        value: String(landlord.totalOwnedGames),
        label: "OWNED GAMES",
      }}
      punchline={`Owns ${landlord.victimCount} managers. Rent is due.`}
      lines={[
        { label: "Tenants", value: String(landlord.victimCount) },
        {
          label: "Favorite Tenant",
          value: landlord.bestVictim
            ? `${landlord.bestVictim.victimName} (${landlord.bestVictim.record})`
            : "—",
        },
      ]}
      back={{
        lines: landlord.victims.map((v) => ({
          label: v.victimName,
          value: v.record,
        })),
      }}
      season="2024–25"
      onClick={() => onOpenCell(landlord.bestVictim?.cellKey ?? null)}
      enableShare={true}
      isPremium={isPremium}
      roastContext={{
        victimName: landlord.bestVictim?.victimName,
        landlordName: landlord.landlordName,
      }}
    />
  ) : null;

  const mostOwnedCard = mostOwned ? (
    <BaseballCard
      badge="NEMESIS"
      title="BIGGEST VICTIM 😭"
      name={mostOwned.victimName}
      avatarUrl={avatarByKey[mostOwned.victimKey] ?? null}
      emoji={emojiByKey[mostOwned.victimKey] ?? null}
      primaryStat={{
        value: String(mostOwned.timesOwned),
        label: "TIMES OWNED",
      }}
      punchline={`Owned by ${mostOwned.timesOwned} managers. It's rough.`}
      lines={[
        { label: "Kryptonite", value: mostOwned.worstNemesisName ?? "—" },
        { label: "Games", value: String(mostOwned.totalGames) },
      ]}
      season="2024–25"
      onClick={() => onOpenCell(mostOwned.cellKey ?? null)}
      enableShare={isPremium}
      isPremium={isPremium}
      roastContext={{
        victimName: mostOwned.victimName,
        landlordName: mostOwned.worstNemesisName,
      }}
    />
  ) : null;

  const biggestRivalryCard = biggestRivalry ? (
    <BaseballCard
      badge="RIVAL"
      title="BIGGEST RIVALRY ⚔️"
      name={`${biggestRivalry.aName} vs ${biggestRivalry.bName}`}
      avatarUrl={avatarByKey[biggestRivalry.aKey] ?? null}
      emoji={emojiByKey[biggestRivalry.aKey] ?? null}
      primaryStat={{
        value: biggestRivalry.record,
        label: "RECORD",
      }}
      punchline="These two hate each other."
      lines={[
        { label: "Games", value: String(biggestRivalry.games) },
        { label: "Score", value: fmtScore(biggestRivalry.score) },
      ]}
      season="2024–25"
      onClick={() => onOpenCell(biggestRivalry.cellKey ?? null)}
      enableShare={isPremium}
      isPremium={isPremium}
      roastContext={{
        opponentName: biggestRivalry.bName,
        record: biggestRivalry.record,
      }}
    />
  ) : null;

  const hasViewer = Boolean(viewerName);
  const buildingReceiptsNote = !landlord && !mostOwned && !biggestRivalry;
  const hasAnyCard =
    Boolean(landlordCard) ||
    Boolean(hasViewer && nflDoppelgangerCard) ||
    Boolean(hasViewer && personalHookBaseballCard) ||
    Boolean(mostOwnedCard) ||
    Boolean(biggestRivalryCard);

  if (isPremium) {
    return (
      <div className="space-y-3">
        {hasAnyCard ? (
          <RoastDeckCarousel>
            {landlordCard}
            {hasViewer && nflDoppelgangerCard}
            {hasViewer && personalHookBaseballCard}
            {mostOwnedCard}
            {biggestRivalryCard}
          </RoastDeckCarousel>
        ) : null}
        {buildingReceiptsNote && (
          <p className="text-xs text-muted-foreground text-center px-2">
            More receipts unlock as the season builds (landlord needs a 3–0 H2H).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasAnyCard ? (
        <RoastDeckCarousel>
          {landlordCard}
          {hasViewer && nflDoppelgangerCard}
          {hasViewer && personalHookBaseballCard}
          {mostOwnedCard && (
            <BlurredCardWrapper onUnlock={onUnlock}>{mostOwnedCard}</BlurredCardWrapper>
          )}
          {biggestRivalryCard && (
            <BlurredCardWrapper onUnlock={onUnlock}>{biggestRivalryCard}</BlurredCardWrapper>
          )}
        </RoastDeckCarousel>
      ) : null}
      {buildingReceiptsNote && (
        <p className="text-xs text-muted-foreground text-center px-2">
          More receipts unlock as the season builds (landlord needs a 3–0 H2H).
        </p>
      )}
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
