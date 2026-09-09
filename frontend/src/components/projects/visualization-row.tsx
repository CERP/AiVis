import Link from "next/link";

import type { VisualizationSummary } from "@/lib/api/visualizations";
import { relativeTime } from "@/lib/format";

// Lightweight text glyphs, not real chart renders -- a project hub listing many visualizations
// should stay fast, and a full Vega render per row would cost far more than this page needs.
const CHART_TYPE_GLYPH: Record<string, string> = {
  bar: "▭▭▭",
  grouped_bar: "▥▥▥",
  stacked_bar: "▤▤▤",
  line: "⟋",
  area: "▲",
  scatter: "⋮⋰",
  histogram: "▁▃▅",
  box_plot: "⊟",
  donut: "◍",
  pie: "◔",
  kpi: "#",
  table: "▦",
};

function chartTypeLabel(chartType: string | null): string {
  if (!chartType) return "Chart";
  return chartType
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function VisualizationRow({
  visualization,
  projectId,
}: {
  visualization: VisualizationSummary;
  projectId: string;
}) {
  return (
    <li className="flex items-center gap-3.5 border-b border-border px-1 py-3.5 last:border-b-0 hover:bg-surface-muted">
      <Link
        href={`/projects/${projectId}/visualizations/${visualization.id}`}
        className="flex min-w-0 flex-1 items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm-token)] bg-surface-muted font-mono text-sm text-muted-foreground"
        >
          {visualization.chart_type ? CHART_TYPE_GLYPH[visualization.chart_type] ?? "▭" : "▭"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-foreground">
            {visualization.title}
          </span>
          <span className="block truncate text-[12.5px] text-subtle-foreground">
            {chartTypeLabel(visualization.chart_type)} · from {visualization.dataset_name} · edited{" "}
            {relativeTime(visualization.updated_at)}
          </span>
        </span>
      </Link>
    </li>
  );
}
