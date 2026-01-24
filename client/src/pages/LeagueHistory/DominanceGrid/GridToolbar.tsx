import { Button } from "@/components/ui/button";
import type { Badge } from "../types";

type Props = {
  onDownloadPng: () => void;
  onSharePng: () => void;
  isDownloading: boolean;
  isSharing: boolean;
  hasData: boolean;
};

export function GridToolbar({
  onDownloadPng,
  onSharePng,
  isDownloading,
  isSharing,
  hasData,
}: Props) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b bg-background px-4 py-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={onDownloadPng}
        disabled={!hasData || isDownloading || isSharing}
      >
        {isDownloading ? "Exporting…" : "Download PNG"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onSharePng}
        disabled={!hasData || isDownloading || isSharing}
      >
        {isSharing ? "Exporting…" : "Share"}
      </Button>
    </div>
  );
}
