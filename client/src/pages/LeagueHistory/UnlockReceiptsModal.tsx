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
};

export function UnlockReceiptsModal({
  open,
  onOpenChange,
  onUnlock,
}: Props) {
  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Unlock the Receipts
          </DialogTitle>
          <DialogDescription className="pt-2">
            See the truth for free. Share the truth with Premium.
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
            Unlock (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
