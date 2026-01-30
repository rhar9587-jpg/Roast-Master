import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "fantasy-roast-upgradeDismissedUntil";
// Super Bowl Promo Pricing
const PRICE_FULL = 29;
const PRICE_PROMO = 19;
const PROMO_DEADLINE = "Feb 10";

type Props = {
  onUpgrade?: () => void;
  onScrollToTop?: () => void;
  leagueName?: string;
  lockedReceiptsCount?: number;
  lockedStorylinesCount?: number;
  lockedTotalCount?: number;
  isDemo?: boolean;
};

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const dismissedUntil = localStorage.getItem(STORAGE_KEY);
  if (!dismissedUntil) return false;
  const until = parseInt(dismissedUntil, 10);
  if (isNaN(until)) return false;
  return Date.now() < until;
}

function setDismissed(): void {
  if (typeof window === "undefined") return;
  const dismissedUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  localStorage.setItem(STORAGE_KEY, String(dismissedUntil));
}

export function StickyUpgradeBar({
  onUpgrade,
  onScrollToTop,
  leagueName,
  lockedReceiptsCount,
  lockedStorylinesCount,
  lockedTotalCount,
  isDemo = false,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedState, setIsDismissedState] = useState(false);

  useEffect(() => {
    if (isDismissed()) {
      setIsDismissedState(true);
      return;
    }
    setIsDismissedState(false);
  }, []);

  useEffect(() => {
    if (isDismissedState) return;

    const handleScroll = () => {
      const banner = document.getElementById("conversion-banner");
      if (!banner) {
        setIsVisible(false);
        return;
      }

      const rect = banner.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Show when banner is ~50% past viewport bottom
      const threshold = viewportHeight * 0.5;

      if (rect.bottom < -threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isDismissedState]);

  const handleDismiss = () => {
    setDismissed();
    setIsDismissedState(true);
    setIsVisible(false);
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    }
  };

  const handleScrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!isVisible || isDismissedState) return null;

  const showMissingCounts =
    !isDemo &&
    typeof lockedReceiptsCount === "number" &&
    typeof lockedStorylinesCount === "number" &&
    lockedReceiptsCount > 0 &&
    lockedStorylinesCount > 0;

  // Demo-specific sticky bar
  if (isDemo) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                This is demo data. Get the real roasts for YOUR league •{" "}
                <span className="line-through text-muted-foreground">${PRICE_FULL}</span>{" "}
                <span className="font-bold">${PRICE_PROMO}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-center">
                <Button
                  onClick={handleScrollToTop}
                  size="sm"
                  className="font-semibold whitespace-nowrap interact-cta"
                >
                  Enter My League
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Ends {PROMO_DEADLINE}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 interact-icon"
                onClick={handleDismiss}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Non-demo sticky bar (original)
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        {showMissingCounts && (
          <div className="text-xs font-semibold text-muted-foreground mb-1">
            Unlock {lockedReceiptsCount} more roasts + {lockedStorylinesCount} storylines in this league.
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              Unlock the full roast for {leagueName?.trim() ? leagueName : "this league"} •{" "}
              <span className="line-through text-muted-foreground">${PRICE_FULL}</span>{" "}
              <span className="font-bold">${PRICE_PROMO}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-center">
              <Button
                onClick={handleUpgrade}
                size="sm"
                className="font-semibold whitespace-nowrap interact-cta"
              >
                Unlock — ${PRICE_PROMO}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Ends {PROMO_DEADLINE}
              </p>
              {typeof lockedTotalCount === "number" && lockedTotalCount > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Your league has {lockedTotalCount} roasts waiting.
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 interact-icon"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs font-semibold text-muted-foreground mt-1">
          Risk-free • 30-day money-back guarantee
        </div>
      </div>
    </div>
  );
}
