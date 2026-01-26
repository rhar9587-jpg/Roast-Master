import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const PRICE_ONE_TIME = 29;
const EXAMPLE_LEAGUE_ID = "1204010682635255808";

type Props = {
  onUpgrade?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
  leagueName?: string;
  leagueId?: string;
};

export function ConversionBanner({ onUpgrade, ownedCount, rivalryExists, leagueName, leagueId }: Props) {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default: scroll to top or show placeholder
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Card
      className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-lg animate-in fade-in duration-500"
      id="conversion-banner"
    >
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Unlock FULL receipts for {leagueName?.trim() ? leagueName : "this league"} — ${PRICE_ONE_TIME} (one-time)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="max-w-2xl mx-auto">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Dominance grid + headlines</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Hero receipts deck</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Shareable cards (PNG + captions)</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mt-2 text-center">
          Why pay? Because every group chat needs receipts.
        </p>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="font-semibold px-8"
          >
            Unlock Full Receipts ($29)
          </Button>
        </div>

        {leagueId === EXAMPLE_LEAGUE_ID && (
          <div className="text-center text-xs text-muted-foreground">
            <button onClick={handleUpgrade} className="text-primary hover:underline font-medium">
              Unlock this league ($29)
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
