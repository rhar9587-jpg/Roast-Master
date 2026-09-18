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
import { OFFER } from "@/lib/brand";
import { unlockLeagues } from "./premium";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId?: string;
  sessionId?: string | null;
  /** Post-checkout save vs cold restore */
  mode?: "save" | "restore";
  onRestored?: (leagueIds: string[]) => void;
};

export function RestorePurchaseModal({
  open,
  onOpenChange,
  leagueId,
  sessionId,
  mode = "restore",
  onRestored,
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPortal, setHasPortal] = useState(false);

  const title =
    mode === "save" ? "Save your unlock" : "Restore purchase";
  const description =
    mode === "save"
      ? "Enter the email you used at Stripe checkout so you can restore this league on another device. No account required."
      : "Lost unlock after clearing browser data? Enter the email from your Stripe receipt.";

  async function handleRestore() {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter the email you used at checkout.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "save") {
        if (!leagueId?.trim()) {
          setError("Missing league id.");
          return;
        }
        const res = await fetch("/api/unlock/save-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmed,
            league_id: leagueId.trim(),
            ...(sessionId ? { session_id: sessionId } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not save unlock.");
          return;
        }
        const leagueIds: string[] = Array.isArray(data.league_ids)
          ? data.league_ids
          : [leagueId.trim()];
        unlockLeagues(leagueIds);
        onRestored?.(leagueIds);
        onOpenChange(false);
        return;
      }

      const res = await fetch("/api/unlock/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          ...(leagueId?.trim() ? { league_id: leagueId.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not restore unlock.");
        return;
      }
      const leagueIds: string[] = Array.isArray(data.league_ids) ? data.league_ids : [];
      unlockLeagues(leagueIds);
      setHasPortal(Boolean(data.has_customer_portal));
      onRestored?.(leagueIds);
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter your purchase email first.");
      return;
    }
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Billing portal unavailable.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="block text-sm font-medium text-foreground">
            Purchase email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            disabled={loading || portalLoading}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {OFFER.unlockOnce} • {OFFER.noSubscription} • We only use this to look up your unlock.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {mode === "save" ? "Maybe later" : "Cancel"}
          </Button>
          <Button
            onClick={handleRestore}
            disabled={loading}
            className="w-full sm:w-auto font-semibold interact-cta"
          >
            {loading
              ? "Looking up…"
              : mode === "save"
                ? "Save unlock"
                : "Restore unlock"}
          </Button>
        </DialogFooter>

        {(hasPortal || mode === "restore") && (
          <div className="text-center pt-1">
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              onClick={handlePortal}
              disabled={portalLoading}
            >
              {portalLoading ? "Opening portal…" : "Open Stripe billing portal"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
