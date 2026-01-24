
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="mt-4 flex gap-2 justify-end">
      <Button onClick={exportPng} disabled={isExporting}>
        <Download className="h-4 w-4 mr-2" />
        Download PNG
      </Button>

      {/* Share with tooltip */}
      <div className="relative group">
        <Button variant="secondary" onClick={share} disabled={isExporting}>
          <Share2 className="h-4 w-4 mr-2" />
          Post the Roast
        </Button>

        {/* Tooltip */}
        <div
          role="tooltip"
          className="
            pointer-events-none absolute -top-11 right-0 z-50
            whitespace-nowrap rounded-lg bg-black/90 px-3 py-2
            text-xs font-semibold text-white shadow-lg
            opacity-0 translate-y-1 transition
            group-hover:opacity-100 group-hover:translate-y-0
          "
        >
          Let the league witness this.
          <div className="absolute right-4 top-full h-2 w-2 rotate-45 bg-black/90" />
        </div>
      </div>
    </div>
  );
}