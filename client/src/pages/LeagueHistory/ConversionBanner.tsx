import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

// Super Bowl Promo Pricing
const PRICE_FULL = 29;
const PRICE_PROMO = 19;
const PROMO_DEADLINE = "Feb 10";
const EXAMPLE_LEAGUE_ID = "demo-group-chat-dynasty";

type Props = {
  onUpgrade?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
  leagueName?: string;
  leagueId?: string;
  lockedReceiptsCount?: number;
  lockedStorylinesCount?: number;
  lockedTotalCount?: number;
};

export function ConversionBanner({
  onUpgrade,
  ownedCount,
  rivalryExists,
  leagueName,
  leagueId,
  lockedReceiptsCount,
  lockedStorylinesCount,
  lockedTotalCount,
}: Props) {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default: scroll to top or show placeholder
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const showMissingCounts =
    typeof lockedReceiptsCount === "number" &&
    typeof lockedStorylinesCount === "number" &&
    lockedReceiptsCount > 0 &&
    lockedStorylinesCount > 0;

  return (
    <Card
      className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-lg animate-in fade-in duration-500"
      id="conversion-banner"
    >
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {leagueName?.trim() ? leagueName : "This league"} has receipts waiting.{" "}
          <span className="line-through text-muted-foreground font-normal">${PRICE_FULL}</span>{" "}
          <span className="text-primary">${PRICE_PROMO}</span> — Super Bowl price.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="max-w-2xl mx-auto">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Every matchup. Every roast.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>The moments your league will argue about.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Drop chaos in the group chat.</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mt-2 text-center">
          Why pay? Because every group chat needs a roast.
        </p>

        {/* CTA */}
        <div className="text-center">
          {showMissingCounts && (
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Unlock {lockedReceiptsCount} more roasts + {lockedStorylinesCount} storylines in this league.
            </div>
          )}
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="font-semibold px-8"
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
        <p className="text-sm font-semibold text-center">
          Risk-free • 30-day money-back guarantee
        </p>

        {leagueId === EXAMPLE_LEAGUE_ID && (
          <div className="text-center text-xs text-muted-foreground">
            <button onClick={handleUpgrade} className="text-primary hover:underline font-medium">
              Unlock Full Roast — ${PRICE_PROMO}
            </button>
            {" "}or{" "}
            <button
              onClick={() => {
                window.location.href = "/league-history/dominance";
              }}
              className="text-primary hover:underline font-medium"
            >
              load your league
            </button>
          </div>
        )}

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
