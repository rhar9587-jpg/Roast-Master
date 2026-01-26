import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const PRICE_ONE_TIME = 29;

type Props = {
  onUpgrade?: () => void;
  ownedCount?: number;
  rivalryExists?: boolean;
};

export function ConversionBanner({ onUpgrade, ownedCount, rivalryExists }: Props) {
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
          Turn this into a league moment
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
          You already see the truth. Premium lets you drop the receipts and start the chaos.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pricing */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-4xl font-bold">${PRICE_ONE_TIME}</span>
            <span className="text-sm text-muted-foreground">one-time</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            $29 one-time • No subscription • Lifetime access
          </p>
        </div>

        {/* Social-Focused Benefits */}
        <div className="max-w-2xl mx-auto">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Tag your nemesis in the group chat</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Start the rivalry debates</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Create the receipts everyone argues about</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Share the drama</span>
            </li>
          </ul>
        </div>

        {/* Value Anchor */}
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Headlines, League Storylines, and all exports — <strong>$29 once</strong>.
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
