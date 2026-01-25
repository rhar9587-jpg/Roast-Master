import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  async function handleCopyLink() {
    setIsCopying(true);
    try {
      const url = window.location.href;
      
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      toast({
        title: "Link copied!",
        description: "Roast copied. Send it to the group chat 💀",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <div className="sticky top-0 z-20 border-b bg-background px-4 py-3">
      <div className="flex flex-wrap items-start justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          disabled={isCopying || isDownloading || isSharing}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          {isCopying ? "Copying…" : "Copy Roast Link"}
        </Button>
        <div className="flex flex-col items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownloadPng}
            disabled={!hasData || isDownloading || isSharing}
          >
            {isDownloading ? "Saving…" : "Save Roast"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1 text-center whitespace-nowrap">Perfect for the league chat</p>
        </div>
        <div className="flex flex-col items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={onSharePng}
            disabled={!hasData || isDownloading || isSharing}
          >
            {isSharing ? "Sending…" : "Send to Group Chat"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1 text-center whitespace-nowrap">Tag your nemesis 💀</p>
        </div>
      </div>
    </div>
  );
}
