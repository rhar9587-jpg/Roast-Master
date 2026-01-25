import type { MiniCard } from "./storylines";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

type MiniCardProps = {
  card: MiniCard;
  onOpenCell?: (cellKey: string) => void;
  onHighlightManager?: (managerKey: string) => void;
  forExport?: boolean;
};

function MiniCardItem({
  card,
  onOpenCell,
  onHighlightManager,
  forExport,
}: MiniCardProps) {
  const hasClickAction =
    !forExport && (Boolean(card.cellKey) || Boolean(card.managerKey));
  const base =
    "w-full text-left rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-4 flex flex-col h-full";
  const interactive =
    "hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer";

  const detailClass = forExport
    ? "text-xs text-muted-foreground mt-auto break-words overflow-visible"
    : "text-xs text-muted-foreground mt-auto truncate";

  const handleClick = () => {
    if (forExport) return;
    if (card.cellKey && onOpenCell) {
      onOpenCell(card.cellKey);
    } else if (card.managerKey && onHighlightManager) {
      onHighlightManager(card.managerKey);
    }
  };

  const secondaryMetaLine =
    card.statSecondary && card.meta
      ? `${card.statSecondary} · ${card.meta}`
      : card.statSecondary || card.meta || null;

  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {card.title}
      </p>
      <p className="text-xl md:text-2xl font-bold tracking-tight leading-tight mb-1">
        {card.statPrimary}
      </p>
      {secondaryMetaLine ? (
        <p className="text-xs text-muted-foreground mb-1.5">
          {secondaryMetaLine}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground mb-1.5">{card.line}</p>
      {card.detail ? (
        <p className={detailClass} title={forExport ? undefined : card.detail}>
          {card.detail}
        </p>
      ) : null}
    </>
  );

  if (hasClickAction) {
    return (
      <button
        type="button"
        className={`${base} ${interactive}`}
        onClick={handleClick}
      >
        {body}
      </button>
    );
  }

  return <div className={base}>{body}</div>;
}

type ExportFooterProps = { timestamp: string };

function ExportFooter({ timestamp }: ExportFooterProps) {
  return (
    <div className="mt-4 pt-3 border-t border-border text-center text-xs text-muted-foreground">
      Fantasy Roast · {timestamp}
    </div>
  );
}

type Props = {
  leagueCards: MiniCard[];
  yourRoastCards: MiniCard[];
  viewerChosen: boolean;
  onOpenCell?: (cellKey: string) => void;
  onHighlightManager?: (managerKey: string) => void;
  storylinesExportRef?: React.RefObject<HTMLDivElement | null>;
  yourRoastExportRef?: React.RefObject<HTMLDivElement | null>;
  exportTimestamp?: string;
  isPremium: boolean;
  onUnlock?: () => void;
};

const YOUR_ROAST_EMPTY_MESSAGE =
  "Pick a wider range to find real receipts.";

export function StorylinesMiniCards({
  leagueCards,
  yourRoastCards,
  viewerChosen,
  onOpenCell,
  onHighlightManager,
  storylinesExportRef,
  yourRoastExportRef,
  exportTimestamp,
  isPremium,
  onUnlock,
}: Props) {
  const ts = exportTimestamp ?? new Date().toLocaleString();

  return (
    <div className="space-y-8">
      {leagueCards.length > 0 && (
        <section className="relative">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            The receipts everyone's talking about
          </h2>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ${!isPremium ? "opacity-60 blur-sm pointer-events-none" : ""}`}>
            {leagueCards.map((c) => (
              <MiniCardItem
                key={c.id}
                card={c}
                onOpenCell={onOpenCell}
                onHighlightManager={onHighlightManager}
              />
            ))}
          </div>
          {!isPremium && (
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center cursor-pointer"
              onClick={onUnlock}
            >
              <div className="text-center space-y-3 p-6">
                <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-semibold">Unlock the league receipts</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export and share the chaos
                  </p>
                </div>
                <Button onClick={onUnlock} size="sm">
                  Unlock the Receipts
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {viewerChosen && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Your personal receipts
          </h2>
          {yourRoastCards.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {yourRoastCards.map((c) => (
                <MiniCardItem
                  key={c.id}
                  card={c}
                  onOpenCell={onOpenCell}
                  onHighlightManager={onHighlightManager}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {YOUR_ROAST_EMPTY_MESSAGE}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Hidden export DOM: League Storylines */}
      {leagueCards.length > 0 && storylinesExportRef && (
        <div
          ref={storylinesExportRef as React.RefObject<HTMLDivElement>}
          className="fixed pointer-events-none"
          style={{
            left: 0,
            top: 0,
            clipPath: "inset(100%)",
            zIndex: 1,
          }}
        >
          <div className="rounded-2xl border border-border bg-white p-5 w-max max-w-2xl min-w-[320px]">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              League Storylines
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {leagueCards.map((c) => (
                <MiniCardItem key={c.id} card={c} forExport />
              ))}
            </div>
            <ExportFooter timestamp={ts} />
          </div>
        </div>
      )}

      {/* Hidden export DOM: Your Roast */}
      {viewerChosen && yourRoastCards.length > 0 && yourRoastExportRef && (
        <div
          ref={yourRoastExportRef as React.RefObject<HTMLDivElement>}
          className="fixed pointer-events-none"
          style={{
            left: 0,
            top: 0,
            clipPath: "inset(100%)",
            zIndex: 1,
          }}
        >
          <div className="rounded-2xl border border-border bg-white p-5 w-max max-w-2xl min-w-[320px]">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Your Roast
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {yourRoastCards.map((c) => (
                <MiniCardItem key={c.id} card={c} forExport />
              ))}
            </div>
            <ExportFooter timestamp={ts} />
          </div>
        </div>
      )}
    </div>
  );
}
