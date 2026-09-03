"use client";

import type { VisualizationSpec } from "@/lib/visualization/spec";

/** Deterministic aggregation over real row data -- no fabricated numbers. Mirrors the
 * aggregation vocabulary already used by the Vega-Lite compiler (sum/mean/median/count/min/max),
 * computed here in JS since a KPI card is a single scalar, not a chart spec. */
function aggregate(values: number[], fn: string): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "median": {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "count":
      return values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

interface KPICardProps {
  spec: VisualizationSpec;
  rows: Record<string, unknown>[];
}

export function KPICard({ spec, rows }: KPICardProps) {
  const metricField = spec.encoding.size?.field;
  const aggregation = spec.encoding.size?.aggregation ?? "sum";
  const timeField = spec.encoding.x?.field;

  if (!metricField) {
    return (
      <div role="alert" className="rounded-[var(--radius-token)] border border-negative/30 bg-accent-muted p-4 text-sm text-negative">
        KPI card requires a measure field.
      </div>
    );
  }

  const values = rows
    .map((r) => r[metricField])
    .filter((v): v is number => typeof v === "number");

  const value = aggregate(values, aggregation);

  // Period-over-period comparison is only computed when a real ordered time field exists and
  // has at least two distinct values -- never a fabricated "vs previous period" number.
  let changePct: number | null = null;
  if (timeField) {
    const sortedByTime = [...rows]
      .filter((r) => r[timeField] != null && typeof r[metricField] === "number")
      .sort((a, b) => String(a[timeField]).localeCompare(String(b[timeField])));
    if (sortedByTime.length >= 2) {
      const first = sortedByTime[0][metricField] as number;
      const last = sortedByTime[sortedByTime.length - 1][metricField] as number;
      if (first !== 0) changePct = ((last - first) / Math.abs(first)) * 100;
    }
  }

  const formattedValue = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div
      role="img"
      aria-label={`${spec.typography.title ?? metricField}: ${formattedValue}${changePct !== null ? `, ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(1)} percent` : ""}`}
      className="flex flex-col gap-1 rounded-[var(--radius-token)] border border-border bg-surface p-6 shadow-sm"
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {spec.typography.title ?? metricField}
      </span>
      <span className="font-headline text-3xl font-bold">{formattedValue}</span>
      {changePct !== null && (
        <span className={changePct >= 0 ? "text-sm text-positive" : "text-sm text-negative"}>
          {changePct >= 0 ? "↑" : "↓"} {Math.abs(changePct).toFixed(1)}%
          <span className="ml-1 text-muted-foreground">vs first period</span>
        </span>
      )}
    </div>
  );
}
