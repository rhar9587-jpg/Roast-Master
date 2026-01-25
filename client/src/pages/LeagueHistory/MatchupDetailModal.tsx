import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2 } from "lucide-react";
import { badgePill, getBadgeDisplayName } from "./utils";
import type { DominanceCellDTO } from "./types";

type Props = {
  selected: DominanceCellDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MatchupDetailModal({
  selected,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();

  async function handleShareMatchup() {
    if (!selected) return;
    
    try {
      // Build URL with matchup anchor
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = `matchup-${selected.a}-${selected.b}`;
      const shareUrl = currentUrl.toString();
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share this matchup link with your league",
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast({
          title: "Link copied!",
          description: "Share this matchup link with your league",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {selected.aName} vs {selected.bName}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex gap-2 items-center">
                <span
                  className={`text-xs rounded px-2 py-1 ${badgePill(
                    selected.badge
                  )}`}
                >
                  {getBadgeDisplayName(selected.badge)}
                </span>
                <span className="text-muted-foreground">
                  {selected.games} games
                </span>
              </div>

              <div className="rounded border p-3 space-y-1">
                <div>
                  <span className="text-muted-foreground">Record:</span>{" "}
                  {selected.record}
                </div>
                <div>
                  <span className="text-muted-foreground">Score:</span>{" "}
                  {selected.score >= 0 ? "+" : ""}
                  {selected.score.toFixed(2)}
                </div>
                <div>
                  <span className="text-muted-foreground">Points For:</span>{" "}
                  {selected.pf.toFixed(2)}
                </div>
                <div>
                  <span className="text-muted-foreground">Points Against:</span>{" "}
                  {selected.pa.toFixed(2)}
                </div>
              </div>

              <Button
                className="w-full"
                variant="secondary"
                onClick={handleShareMatchup}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Send This Receipt
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
