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
              <p className="text-xs font-medium text-muted-foreground">
                Unlock to reveal the receipts
              </p>
            </div>
          )}
        </div>
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
    />
  ));

  if (isPremium) {
    return (
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">League Receipts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The moments your league will never forget.
          </p>
        </div>
        <RoastDeckCarousel>{cards}</RoastDeckCarousel>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">League Receipts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The moments your league will never forget.
        </p>
      </div>
      <RoastDeckCarousel>
        {cards.map((card, idx) => (
          <BlurredCardWrapper key={heroReceipts[idx].id} onUnlock={onUnlock}>
            {card}
          </BlurredCardWrapper>
        ))}
      </RoastDeckCarousel>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Unlock to reveal the full receipts and share the truth.
      </p>
    </div>
  );
}
