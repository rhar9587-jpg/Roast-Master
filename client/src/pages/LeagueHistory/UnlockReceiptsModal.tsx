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
};

export function UnlockReceiptsModal({
  open,
  onOpenChange,
  onUnlock,
  ownedCount,
  rivalryExists,
}: Props) {
  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    }
    onOpenChange(false);
  };

  // Contextual copy logic
  const contextualCopy = ownedCount && ownedCount > 0
    ? `You own ${ownedCount} manager${ownedCount === 1 ? '' : 's'}. Want the receipts to prove it?`
    : rivalryExists
      ? "Your league has a real rivalry. See the full story."
      : "Your league has stories worth sharing. Unlock the receipts.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Unlock the Receipts
          </DialogTitle>
          <DialogDescription className="pt-2">
            {contextualCopy}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pricing */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-bold">${PRICE_ONE_TIME}</span>
              <span className="text-sm text-muted-foreground">one-time</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              no subscription
            </p>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>Reveal the headlines</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>Export the receipts</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>Share the chaos</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>League Storylines</span>
            </div>
          </div>
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
            Join 500+ leagues already roasting
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
          <Button
            onClick={handleUnlock}
            className="w-full sm:w-auto font-semibold"
          >
            Try Premium
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
