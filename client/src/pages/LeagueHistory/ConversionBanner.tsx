import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OFFER, PRICE_LABEL, unlockCtaLabel } from "@/lib/brand";

type Props = {
  onUpgrade?: () => void;
  onScrollToTop?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
  leagueName?: string;
  leagueId?: string;
  lockedReceiptsCount?: number;
  lockedStorylinesCount?: number;
  lockedTotalCount?: number;
  isDemo?: boolean;
  onCompUnlock?: () => void;
};

export function ConversionBanner({
  onUpgrade,
  onScrollToTop,
  ownedCount,
  rivalryExists,
  leagueName,
  leagueId,
  lockedReceiptsCount,
  lockedStorylinesCount,
  lockedTotalCount,
  isDemo = false,
  onCompUnlock,
}: Props) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      } else {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleScrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Demo-specific content
  if (isDemo) {
    return (
      <Card
        className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-lg animate-in fade-in duration-500"
        id="conversion-banner"
      >
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {`Want the receipts for YOUR league? ${unlockCtaLabel()}.`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-2xl mx-auto">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span><strong>League Receipts</strong> — who owns who in YOUR league: dominance, grids, archetypes.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Also included:</strong> weekly cards + commissioner email, and your season recap.
                </span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground mt-2 text-center">
            This is demo data. The real receipts are in YOUR league.
          </p>

          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Enter your Sleeper username above to get started.
            </p>
            <Button
              onClick={handleScrollToTop}
              size="lg"
              className="font-semibold px-8 interact-cta"
            >
              {`Get my league — ${PRICE_LABEL}`}
            </Button>
          </div>
          <p className="text-sm font-semibold text-center">
            Try it with a {OFFER.moneyBack.toLowerCase()}.
          </p>

          {/* Trust & Social Proof */}
          <div className="text-center space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Built for group chats and league banter.
            </p>
            <p className="text-xs text-muted-foreground">
              {OFFER.moneyBack} • Secure checkout
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-lg animate-in fade-in duration-500"
      id="conversion-banner"
    >
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {`${leagueName?.trim() ? leagueName : "This league"} has receipts waiting. ${unlockCtaLabel()}.`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-2xl mx-auto">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>League Receipts</strong> — dominance grid, headlines, storylines, all-time records (share &amp; export)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Also included:</strong> weekly cards + commissioner email, and your season recap.
              </span>
            </li>
          </ul>
        </div>

        <div className="text-center">
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="font-semibold px-8 interact-cta"
          >
            {unlockCtaLabel()}
          </Button>
        </div>
        <p className="text-sm font-semibold text-center">
          Try it with a {OFFER.moneyBack.toLowerCase()}.
        </p>

        <div className="text-center">
          {!showCodeInput ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setShowCodeInput(true)}
            >
              Have a code?
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2">
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

        <div className="text-center space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Built for group chats — the permanent record of who owns who.
          </p>
          <p className="text-xs text-muted-foreground">
            {OFFER.moneyBack} • Secure checkout
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
