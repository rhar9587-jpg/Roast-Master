import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const PRICE_ONE_TIME = 29;

type Props = {
  onUpgrade?: () => void;
};

export function ConversionBanner({ onUpgrade }: Props) {
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
          Unlock the Receipts
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
          See the truth for free. Share the truth with Premium.
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
            No subscription • Lifetime access
          </p>
        </div>

        {/* Feature Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Free */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold text-sm mb-3">Free</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">View grid</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Your Roast</span>
              </li>
            </ul>
          </div>

          {/* Premium */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              Premium
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                Best Value
              </span>
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Export grid</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Headlines</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>League Storylines</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Share images</span>
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="font-semibold px-8"
          >
            Unlock the Receipts
          </Button>
        </div>

        {/* Trust & Social Proof */}
        <div className="text-center space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Built for group chats and league banter.
          </p>
          <p className="text-xs text-muted-foreground">
            30-day money-back guarantee • Secure checkout (coming next)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
