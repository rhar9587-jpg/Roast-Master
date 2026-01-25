import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  matchupCount: number;
  managerCount: number;
  minWeek?: number;
  maxWeek?: number;
  onDismiss?: () => void;
  isPremium: boolean;
};

export function PostAnalysisToast({
  matchupCount,
  managerCount,
  minWeek,
  maxWeek,
  onDismiss,
  isPremium,
}: Props) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        setTimeout(onDismiss, 300); // Wait for fade-out animation
      }
    }, isPremium ? 5000 : 7000); // 7 seconds for free users, 5 for premium

    return () => clearTimeout(timer);
  }, [onDismiss, isPremium]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      setTimeout(onDismiss, 300);
    }
  };

  if (!isVisible) return null;

  const weeksText =
    minWeek && maxWeek
      ? ` • Weeks ${minWeek}–${maxWeek}`
      : minWeek
        ? ` • Week ${minWeek}+`
        : "";

  const title = isPremium ? "Analysis complete!" : "Analysis complete";
  const body = isPremium
    ? `Found ${matchupCount} matchups across ${managerCount} managers${weeksText}.`
    : "Analysis complete! Select your manager above to see your personal roasts.";

  return (
    <Card
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 shadow-lg border-primary/20 bg-gradient-to-br from-background to-primary/5 animate-in slide-in-from-top-2 fade-in duration-300 ${
        !isVisible ? "animate-out slide-out-to-top-2 fade-out" : ""
      }`}
      style={{ maxWidth: "calc(100vw - 2rem)", width: "100%" }}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎉</span>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {body}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
