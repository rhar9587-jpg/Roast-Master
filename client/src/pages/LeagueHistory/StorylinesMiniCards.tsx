import type { MiniCard } from "./storylines";

type MiniCardProps = {
  card: MiniCard;
  onOpenCell?: (cellKey: string) => void;
  forExport?: boolean;
};

function MiniCardItem({ card, onOpenCell, forExport }: MiniCardProps) {
  const isClickable = !forExport && Boolean(card.cellKey && onOpenCell);
  const base =
    "w-full text-left rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-4";
  const interactive =
    "hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const detailClass = forExport
    ? "text-xs text-muted-foreground mt-1 break-words overflow-visible"
    : "text-xs text-muted-foreground mt-1 truncate";

  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {card.title}
      </p>
      <p className="text-xl md:text-2xl font-bold tracking-tight leading-tight">
        {card.statPrimary}
      </p>
      {card.statSecondary ? (
        <p className="text-xs text-muted-foreground mt-0.5">
          {card.statSecondary}
        </p>
      ) : null}
      {card.meta ? (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {card.meta}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground mt-1.5">{card.line}</p>
      {card.detail ? (
        <p className={detailClass} title={forExport ? undefined : card.detail}>
          {card.detail}
        </p>
      ) : null}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        className={`${base} ${interactive}`}
        onClick={() => card.cellKey && onOpenCell?.(card.cellKey)}
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
  storylinesExportRef?: React.RefObject<HTMLDivElement | null>;
  yourRoastExportRef?: React.RefObject<HTMLDivElement | null>;
  exportTimestamp?: string;
};

const YOUR_ROAST_EMPTY_MESSAGE =
  "Pick a wider range to find real receipts.";

export function StorylinesMiniCards({
  leagueCards,
  yourRoastCards,
  viewerChosen,
  onOpenCell,
  storylinesExportRef,
  yourRoastExportRef,
  exportTimestamp,
}: Props) {
  const ts = exportTimestamp ?? new Date().toLocaleString();

  return (
    <div className="space-y-8">
      {leagueCards.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            League Storylines
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {leagueCards.map((c) => (
              <MiniCardItem key={c.id} card={c} onOpenCell={onOpenCell} />
            ))}
          </div>
        </section>
      )}

      {viewerChosen && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Your Roast
          </h2>
          {yourRoastCards.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {yourRoastCards.map((c) => (
                <MiniCardItem key={c.id} card={c} onOpenCell={onOpenCell} />
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
