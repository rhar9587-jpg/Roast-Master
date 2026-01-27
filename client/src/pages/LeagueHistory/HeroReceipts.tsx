import { RoastDeckCarousel } from "@/components/roast/RoastDeckCarousel";
import { BaseballCard } from "@/components/roast/BaseballCard";
import type { HeroReceiptCard } from "./types";
import { Lock } from "lucide-react";
import { useState } from "react";
import * as React from "react";

type Props = {
  heroReceipts: HeroReceiptCard[];
  isPremium: boolean;
  onUnlock?: () => void;
};

type CardWrapperProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onUnlock?: () => void;
  showOverlay?: boolean;
};

// Helper component to align headings across cards
function CardWithHeading({
  children,
  title,
  subtitle,
  onUnlock,
  showOverlay = false,
}: CardWrapperProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="text-xs text-muted-foreground min-h-[16px]">
        {subtitle ? subtitle : <span className="opacity-0">placeholder</span>}
      </div>
      <div className="relative">
        <div className={showOverlay ? "blur-sm opacity-60 pointer-events-none" : ""}>
          {children}
        </div>
        {showOverlay && (
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
                    Unlock to reveal the roast
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HeroReceipts({ heroReceipts, isPremium, onUnlock }: Props) {
  if (heroReceipts.length === 0) return null;

  const badgeTextById: Record<string, string> = {
    "biggest-blowout": "BLOWN OUT",
    "stole-one": "LUCKBOX",
    "wooden-spoon": "WOODEN",
    "all-gas": "SOLD OUT",
    "missed-it": "ROBBED",
    "biggest-fall-off": "COLLAPSE",
    "playoff-choker": "CHOKED",
    "monday-night-miracle": "MIRACLE",
    "paper-champion": "PAPER",
  };

  const cards = heroReceipts.map((receipt) => (
    <BaseballCard
      key={receipt.id}
      badge={receipt.badge}
      badgeText={badgeTextById[receipt.id]}
      title={receipt.title}
      name={receipt.name}
      avatarUrl={receipt.avatarUrl ?? null}
      primaryStat={receipt.primaryStat}
      punchline={receipt.punchline}
      lines={receipt.lines}
      season={receipt.season}
      onClick={receipt.onClick}
      enableShare={isPremium}
      isPremium={isPremium}
    />
  ));

  if (isPremium) {
    return (
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">League Roasts</h2>
          <p className="text-xs text-muted-foreground mt-1">
            The moments your league will never forget.
          </p>
        </div>
        <RoastDeckCarousel>{cards}</RoastDeckCarousel>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">League Roasts</h2>
        <p className="text-xs text-muted-foreground mt-1">
          The moments your league will never forget.
        </p>
      </div>
      <RoastDeckCarousel>
        {heroReceipts.map((receipt, index) => {
          const card = (
            <BaseballCard
              key={receipt.id}
              badge={receipt.badge}
              badgeText={badgeTextById[receipt.id]}
              title={receipt.title}
              name={receipt.name}
              avatarUrl={receipt.avatarUrl ?? null}
              primaryStat={receipt.primaryStat}
              punchline={receipt.punchline}
              lines={receipt.lines}
              season={receipt.season}
              onClick={receipt.onClick}
              enableShare={false}
              isPremium={false}
            />
          );

          const remainingCount = heroReceipts.length - 1;
          const subtitle =
            index === 0
              ? undefined
              : `🔒 ${Math.max(remainingCount, 0)} more roasts your league will argue about.`;

          return (
            <CardWithHeading
              key={receipt.id}
              title={receipt.title}
              subtitle={subtitle}
              onUnlock={onUnlock}
              showOverlay={index !== 0}
            >
              {card}
            </CardWithHeading>
          );
        })}
      </RoastDeckCarousel>
    </div>
  );
}
