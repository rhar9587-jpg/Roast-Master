import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Super Bowl Promo Pricing
const PRICE_FULL = 29;
const PRICE_PROMO = 19;
const PROMO_DEADLINE = "Feb 10";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
  leagueName?: string;
  lockedReceiptsCount?: number;
  lockedStorylinesCount?: number;
  lockedTotalCount?: number;
  leagueId?: string;
  onCompUnlock?: () => void;
};

export function UnlockReceiptsModal({
  open,
  onOpenChange,
  onUnlock,
  ownedCount,
  rivalryExists,
  leagueName,
  lockedReceiptsCount,
  lockedStorylinesCount,
  lockedTotalCount,
  leagueId,
  onCompUnlock,
}: Props) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const { toast } = useToast();

  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    }
  };

  const handleCodeSubmit = async () => {
    if (!codeValue.trim() || !leagueId) return;
    setCodeLoading(true);
    try {
      const res = await fetch("/api/comp/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league_id: leagueId, code: codeValue.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (onCompUnlock) onCompUnlock();
        toast({ title: "League unlocked." });
        onOpenChange(false);
      } else {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setCodeLoading(false);
    }
  };

  // Contextual copy logic
  const contextualCopy = ownedCount && ownedCount > 0
    ? `You own ${ownedCount} manager${ownedCount === 1 ? '' : 's'}. Want the roast to prove it?`
    : rivalryExists
      ? "Your league has a real rivalry. See the full story."
      : "Your league has stories worth sharing. Unlock the full roast.";

  const showMissingCounts =
    typeof lockedReceiptsCount === "number" &&
    typeof lockedStorylinesCount === "number" &&
    lockedReceiptsCount > 0 &&
    lockedStorylinesCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Your league has receipts. Time to collect.
          </DialogTitle>
          <DialogDescription className="pt-2">
            Unlock all roasts for {leagueName?.trim() ? leagueName : "this league"}.{" "}
            <span className="line-through text-muted-foreground">${PRICE_FULL}</span>{" "}
            <span className="font-bold text-foreground">${PRICE_PROMO}</span> — Super Bowl price ends {PROMO_DEADLINE}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>Every matchup. Every roast.</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>The moments your league will argue about.</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>Drop chaos in the group chat.</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Why pay? Because every group chat needs a roast.
          </p>
        </div>

        {/* Trust Signals */}
        <div className="space-y-1 pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground">
            One-time purchase • No subscription
          </p>
          <p className="text-xs text-muted-foreground">
            30-day money-back guarantee
          </p>
          <p className="text-xs text-muted-foreground">
            Built for group chats and league banter.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Not now
          </Button>
          <div className="w-full sm:w-auto text-center">
            {showMissingCounts && (
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Unlock {lockedReceiptsCount} more roasts + {lockedStorylinesCount} storylines in this league.
              </div>
            )}
            <Button
              onClick={handleUnlock}
              className="w-full sm:w-auto font-semibold interact-cta"
            >
              Unlock Full Roast — ${PRICE_PROMO}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Split with your league — usually ~$2 each.
            </p>
            <p className="text-xs font-medium text-primary text-center mt-1">
              Super Bowl price ends {PROMO_DEADLINE}
            </p>
            {typeof lockedTotalCount === "number" && lockedTotalCount > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Your league has {lockedTotalCount} roasts waiting.
              </p>
            )}
          </div>
        </DialogFooter>

        {/* CTA Subtext */}
        <p className="text-sm font-semibold text-center mt-2">
          Risk-free • 30-day money-back guarantee
        </p>

        {/* Comp Code Section */}
        <div className="text-center pt-2">
          {!showCodeInput ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setShowCodeInput(true)}
            >
              Have a code?
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Enter code"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                className="w-32 px-2 py-1 text-sm border rounded"
                disabled={codeLoading}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCodeSubmit}
                disabled={codeLoading || !codeValue.trim()}
              >
                {codeLoading ? "..." : "Unlock"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
