import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Personal Unlock Pricing
const PRICE = 7;

type LockedModePreviewProps = {
  title: string;
  description: string;
  previewItems: string[];
  onUnlock: () => void;
  lockedTotalCount?: number;
};

export function LockedModePreview({
  title,
  description,
  previewItems,
  onUnlock,
  lockedTotalCount,
}: LockedModePreviewProps) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {typeof lockedTotalCount === "number" && lockedTotalCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Your league has {lockedTotalCount} roasts waiting.
        </p>
      )}
      <ul className="text-xs text-muted-foreground space-y-1">
        {previewItems.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Button onClick={onUnlock} size="sm" className="interact-cta">
        Unlock for you — ${PRICE}
      </Button>
    </div>
  );
}
