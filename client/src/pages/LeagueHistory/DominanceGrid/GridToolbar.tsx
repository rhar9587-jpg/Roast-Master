import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Badge } from "../types";

type Props = {
  onDownloadPng: () => void;
  onSharePng: () => void;
  isDownloading: boolean;
  isSharing: boolean;
  hasData: boolean;
  isPremium: boolean;
  onUnlock?: () => void;
};

export function GridToolbar({
  onDownloadPng,
  onSharePng,
  isDownloading,
  isSharing,
  hasData,
  isPremium,
  onUnlock,
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

  function handleDownloadClick() {
    if (!isPremium && onUnlock) {
      onUnlock();
    } else {
      onDownloadPng();
    }
  }

  function handleShareClick() {
    if (!isPremium && onUnlock) {
      onUnlock();
    } else {
      onSharePng();
    }
  }

  return (
    <div className="sticky top-0 z-20 border-b bg-background px-4 py-3">
      {/* Mobile: stacked vertically, Desktop: horizontal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        {/* Copy Link - always visible */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          disabled={isCopying || isDownloading || isSharing}
          className="interact-secondary w-full sm:w-auto"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          {isCopying ? "Copying…" : "Copy Link"}
        </Button>

        {/* Save + Share buttons */}
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1 sm:flex-none">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadClick}
                  disabled={!hasData || isDownloading || isSharing}
                  className="interact-secondary w-full"
                >
                  {isDownloading ? "Saving…" : "Save"}
                </Button>
              </span>
            </TooltipTrigger>
            {!isPremium && (
              <TooltipContent>
                <p>Unlock the full roast — $19</p>
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1 sm:flex-none">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleShareClick}
                  disabled={!hasData || isDownloading || isSharing}
                  className="interact-cta w-full"
                >
                  {isSharing ? "Sending…" : "Share"}
                </Button>
              </span>
            </TooltipTrigger>
            {!isPremium && (
              <TooltipContent>
                <p>Unlock the full roast — $19</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
