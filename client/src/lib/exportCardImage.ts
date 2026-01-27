import { toPng } from "html-to-image";

export type ExportOptions = {
  element: HTMLElement;
  filename: string;
  caption?: string;
  isPremium: boolean;
};

export type ExportResult = {
  dataUrl: string;
  caption: string;
  filename: string;
};

/**
 * Export a card element to PNG.
 * Watermark is now rendered directly in the UI via WatermarkOverlay component,
 * so it's captured automatically in the PNG export.
 */
export async function exportCardPng(options: ExportOptions): Promise<ExportResult> {
  const {
    element,
    filename,
    caption = "",
  } = options;

  // Wait for fonts to settle
  await document.fonts.ready;

  // Render to PNG (watermark is already in the DOM via WatermarkOverlay)
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: undefined, // preserve transparency or existing bg
  });

  return {
    dataUrl,
    caption,
    filename,
  };
}

/**
 * Helper to create a File from a dataUrl for native sharing
 */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/png" });
}

/**
 * Helper to trigger a download from a dataUrl
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
