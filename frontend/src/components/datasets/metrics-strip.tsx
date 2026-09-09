import type { ReactNode } from "react";

/** Horizontal readout, not stat cards -- rows/columns/PII/quality read as one line of
 * measurements, matching the "instrument strip" treatment agreed for Dataset Overview. Any
 * metric that isn't available yet is simply omitted rather than rendered as a loading
 * placeholder, so a page with a fast profile but a still-loading analysis doesn't flash empty
 * boxes. */
export function MetricsStrip({
  rowCount,
  columnCount,
  piiCount,
  quality,
  action,
}: {
  rowCount?: number;
  columnCount?: number;
  piiCount?: number;
  quality?: { score: number; label: string; tone: "positive" | "warning" | "negative" };
  action?: ReactNode;
}) {
  const parts: string[] = [];
  if (rowCount !== undefined) parts.push(`${rowCount.toLocaleString()} rows`);
  if (columnCount !== undefined) parts.push(`${columnCount} columns`);
  if (piiCount !== undefined) parts.push(`${piiCount} PII`);

  if (parts.length === 0 && !quality) return null;

  const qualityColor =
    quality?.tone === "positive"
      ? "text-positive"
      : quality?.tone === "negative"
        ? "text-negative"
        : "text-warning";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border py-4">
      <p className="text-[13.5px] text-muted-foreground">
        {parts.join(" · ")}
        {quality && (
          <>
            {parts.length > 0 && " · "}
            Quality:{" "}
            <span className={`font-semibold ${qualityColor}`}>
              {quality.score} — {quality.label}
            </span>
          </>
        )}
      </p>
      {action}
    </div>
  );
}
