import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "fantasy-roast-upgradeDismissedUntil";
const PRICE_ONE_TIME = 29;

type Props = {
  onUpgrade?: () => void;
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

export function StickyUpgradeBar({ onUpgrade }: Props) {
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

  if (!isVisible || isDismissedState) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              Unlock the receipts • ${PRICE_ONE_TIME} one-time
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleUpgrade}
              size="sm"
              className="font-semibold whitespace-nowrap"
            >
              Upgrade →
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
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
