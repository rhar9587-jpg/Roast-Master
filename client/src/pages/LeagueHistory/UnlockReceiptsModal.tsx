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

const PRICE_ONE_TIME = 29;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
  leagueName?: string;
  lockedReceiptsCount?: number;
  lockedStorylinesCount?: number;
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
}: Props) {
  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    }
    onOpenChange(false);
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
            Unlock the full roast for {leagueName?.trim() ? leagueName : "this league"}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {leagueName?.trim() ? leagueName : "This league"} — ${PRICE_ONE_TIME} (one-time)
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
              className="w-full sm:w-auto font-semibold"
            >
              Unlock Full Roast ($29)
            </Button>
          </div>
        </DialogFooter>

        {/* CTA Subtext */}
        <p className="text-sm font-semibold text-center mt-2">
          Risk-free • 30-day money-back guarantee
        </p>
      </DialogContent>
    </Dialog>
  );
}
