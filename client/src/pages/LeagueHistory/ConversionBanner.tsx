import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Personal Unlock Pricing
const PRICE = 7;

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
            Want this for YOUR league? Unlock for you — ${PRICE}.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits - framed for demo */}
          <div className="max-w-2xl mx-auto">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>See who really owns YOUR league.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Expose the choke jobs YOUR friends won't admit.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Drop real receipts in the group chat.</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground mt-2 text-center">
            This is demo data. The real roasts are in YOUR league.
          </p>

          {/* CTA - demo focused */}
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Enter your Sleeper username above to get started.
            </p>
            <Button
              onClick={handleScrollToTop}
              size="lg"
              className="font-semibold px-8 interact-cta"
            >
              Unlock for you — ${PRICE}
            </Button>
          </div>
          <p className="text-sm font-semibold text-center">
            Risk-free • 30-day money-back guarantee
          </p>

          {/* Trust & Social Proof */}
          <div className="text-center space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Built for group chats and league banter.
            </p>
            <p className="text-xs text-muted-foreground">
              30-day money-back guarantee • Secure checkout
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Non-demo content (original)
  return (
    <Card
      className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-lg animate-in fade-in duration-500"
      id="conversion-banner"
    >
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {leagueName?.trim() ? leagueName : "This league"} has receipts waiting. Unlock for you — ${PRICE}.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Benefits - sell the full package */}
        <div className="max-w-2xl mx-auto">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong>All-time Dominance</strong> — who owns who, every season</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong>Hero Roasts</strong> — Landlord, Biggest Victim, Playoff Choker, and more</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong>Weekly Roasts</strong> — chaos from every matchup week</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong>Season Wrapped</strong> — personal highlights for every manager</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong>End-of-Season Recap</strong> — the full league story</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="font-semibold px-8 interact-cta"
          >
            Unlock for you — ${PRICE}
          </Button>
        </div>
        <p className="text-sm font-semibold text-center">
          Risk-free • 30-day money-back guarantee
        </p>

        {/* Comp Code Section */}
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

        {/* Trust & Social Proof */}
        <div className="text-center space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Built for group chats and league banter.
          </p>
          <p className="text-xs text-muted-foreground">
            30-day money-back guarantee • Secure checkout
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
