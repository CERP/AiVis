import type { View } from "vega";

/** Client-side export via Vega's own toSVG/toCanvas APIs. Each function returns the Blob it
 * generated (in addition to triggering the download) so the caller can also persist it via
 * POST /api/exports for a shareable/reopenable record -- rendering happens once, on the
 * client; the backend only ever stores bytes the browser already produced. */

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportSvg(view: View, filename: string): Promise<Blob> {
  const svgString = await view.toSVG();
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
  return blob;
}

export async function exportPng(view: View, filename: string): Promise<Blob> {
  const url = await view.toImageURL("png", 2);
  triggerDownload(url, filename);
  const response = await fetch(url);
  return response.blob();
}
