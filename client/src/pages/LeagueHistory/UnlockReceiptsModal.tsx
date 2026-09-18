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
import { OFFER, unlockCtaLabel } from "@/lib/brand";

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
  onRestorePurchase?: () => void;
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
  onRestorePurchase,
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

  const showMissingCounts =
    typeof lockedReceiptsCount === "number" &&
    typeof lockedStorylinesCount === "number" &&
    lockedReceiptsCount > 0 &&
    lockedStorylinesCount > 0;

  const subtitle =
    ownedCount && ownedCount > 0
      ? `You own ${ownedCount} manager${ownedCount === 1 ? "" : "s"}. Unlock the receipts to share the proof.`
      : rivalryExists
        ? "Your league has a real rivalry. Unlock the receipts to share the full story."
        : "See who owns who for free. Unlock once to export, share, and drop it in the group chat.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Unlock the receipts
          </DialogTitle>
          <DialogDescription className="pt-2">
            {subtitle} {OFFER.unlockOnce}. {OFFER.noSubscription}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>League Receipts</strong> — dominance grid, headlines, archetypes, storylines (share &amp; export)
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-5 w-5 text-primary/70 shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">Also included:</strong> weekly cards + commissioner email, and your season recap
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Built for group chats — the permanent record of who owns who.
          </p>
        </div>

        <div className="space-y-1 pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground">
            {OFFER.unlockOnce} • {OFFER.noSubscription}
          </p>
          <p className="text-xs text-muted-foreground">{OFFER.moneyBack}</p>
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
                Unlock {lockedReceiptsCount} more receipts + {lockedStorylinesCount} storylines in this league.
              </div>
            )}
            <Button
              onClick={handleUnlock}
              className="w-full sm:w-auto font-semibold interact-cta"
            >
              {unlockCtaLabel()}
            </Button>
            {typeof lockedTotalCount === "number" && lockedTotalCount > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Your league has {lockedTotalCount} receipts waiting.
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Each manager unlocks their own view. Sharing is encouraged.
            </p>
          </div>
        </DialogFooter>

        <p className="text-sm font-semibold text-center mt-2">
          Try it with a {OFFER.moneyBack.toLowerCase()}.
        </p>

        {/* Comp Code Section */}
        <div className="text-center pt-2 space-y-2">
          {onRestorePurchase && (
            <button
              type="button"
              className="block mx-auto text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => {
                onOpenChange(false);
                onRestorePurchase();
              }}
            >
              Already paid? Restore purchase
            </button>
          )}
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
