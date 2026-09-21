import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SAVE_IMAGE_LABEL,
  SHARE_THIS_CARD_LABEL,
} from "@/pages/LeagueHistory/shareHierarchyLabels";

type Props = {
  title: string; // used for filename
  children: React.ReactNode; // the card to export
};

export function WrappedExportBar({ title, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filename = useMemo(() => {
    const safe = (title || "roast-wrapped")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${safe}.png`;
  }, [title]);

  const exportPng = async () => {
    if (!ref.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  const share = async () => {
    if (!ref.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      // If native share available (mobile)
      // Otherwise, just download fallback
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Roast Wrapped" });
      } else {
        await exportPng();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div ref={ref}>{children}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={share} disabled={isExporting} className="w-full sm:w-auto">
          <Share2 className="h-4 w-4 mr-2" />
          {SHARE_THIS_CARD_LABEL}
        </Button>
        <Button
          variant="outline"
          onClick={exportPng}
          disabled={isExporting}
          className="w-full sm:w-auto text-muted-foreground"
        >
          <Download className="h-4 w-4 mr-2" />
          {SAVE_IMAGE_LABEL}
        </Button>
      </div>
    </div>
  );
}
