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
import type { MiniCard } from "./storylines";

type Props = {
  // H2H matchup data (existing)
  selected: DominanceCellDTO | null;
  // Mini card with game breakdown (new)
  miniCardDetail: MiniCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MatchupDetailModal({
  selected,
  miniCardDetail,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();

  async function handleShareMatchup() {
    if (!selected && !miniCardDetail) return;
    
    try {
      const currentUrl = new URL(window.location.href);
      if (selected) {
        currentUrl.hash = `matchup-${selected.a}-${selected.b}`;
      } else if (miniCardDetail) {
        currentUrl.hash = `roast-${miniCardDetail.id}`;
      }
      const shareUrl = currentUrl.toString();
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share this roast link with your league",
        });
      } else {
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
          description: "Share this roast link with your league",
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

  // Render H2H matchup view
  const renderH2HView = () => {
    if (!selected) return null;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {selected.aName} vs {selected.bName} ⚔️
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex gap-2 items-center">
            <span
              className={`text-xs rounded px-2 py-1 ${badgePill(selected.badge)}`}
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
              <span className="text-muted-foreground">Ownership score:</span>{" "}
              {selected.score >= 0 ? "+" : ""}
              {selected.score.toFixed(2)}
            </div>
            <div>
              <span className="text-muted-foreground">You scored:</span>{" "}
              {selected.pf.toFixed(2)}
            </div>
            <div>
              <span className="text-muted-foreground">They scored:</span>{" "}
              {selected.pa.toFixed(2)}
            </div>
          </div>

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleShareMatchup}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Send This Roast
          </Button>
        </div>
      </>
    );
  };

  // Render game breakdown view for mini cards
  const renderGameBreakdownView = () => {
    if (!miniCardDetail || !miniCardDetail.detailGames?.length) return null;
    
    const games = miniCardDetail.detailGames;
    
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{miniCardDetail.emoji}</span>
            <span>{miniCardDetail.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-3 text-sm">
          {/* Manager name and summary */}
          <div className="flex flex-col gap-1">
            <span className="font-medium">{miniCardDetail.detail}</span>
            <span className="text-muted-foreground text-xs">
              {miniCardDetail.line}
            </span>
          </div>

          {/* Game breakdown list */}
          <div className="rounded border divide-y max-h-[300px] overflow-y-auto">
            {games.map((game, idx) => {
              const marginDisplay = game.won
                ? `+${game.margin.toFixed(1)}`
                : game.margin.toFixed(1);
              const marginColor = game.won
                ? "text-emerald-600"
                : "text-rose-600";
              
              return (
                <div
                  key={`${game.season}-${game.week}-${idx}`}
                  className="p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Wk {game.week}</span>
                      <span>·</span>
                      <span>{game.season}</span>
                    </div>
                    <div className="text-sm truncate">
                      vs {game.opponent}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {game.yourPoints.toFixed(1)} - {game.theirPoints.toFixed(1)}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${marginColor} shrink-0`}>
                    {marginDisplay}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleShareMatchup}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Send This Roast
          </Button>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        {miniCardDetail?.detailGames?.length ? renderGameBreakdownView() : renderH2HView()}
      </DialogContent>
    </Dialog>
  );
}
