import type { View } from "vega";

/** Client-side export via Vega's own toSVG/toCanvas APIs -- no server round-trip needed for
 * this MVP path. A persisted Export record (Phase 26 backend model) is a documented follow-up
 * for share links/history; this covers the "download what I'm looking at" case. */

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportSvg(view: View, filename: string): Promise<void> {
  const svgString = await view.toSVG();
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export async function exportPng(view: View, filename: string): Promise<void> {
  const url = await view.toImageURL("png", 2);
  triggerDownload(url, filename);
}
