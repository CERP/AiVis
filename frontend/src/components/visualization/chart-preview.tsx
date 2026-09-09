"use client";

import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import type { VisualizationSpec } from "@/lib/visualization/spec";

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
};

/** Chrome-suppressed chart render shared by Analysis findings and (eventually) Chart Explorer
 * cards -- extracted from RecommendationCard's preview block rather than duplicated, and
 * RecommendationCard itself is left untouched since /recommend still depends on it as-is.
 * Renders a text glyph instead of a real chart when no preview rows are available yet, and
 * never throws past its own boundary -- a broken spec degrades this one preview, not the row
 * or page around it (VisualizationRenderer already swallows its own render errors internally). */
export function ChartPreview({
  spec,
  rows,
  heightPx = 160,
}: {
  spec: VisualizationSpec;
  rows?: Record<string, unknown>[];
  heightPx?: number;
}) {
  if (rows && rows.length > 0) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-surface-muted"
        style={{ height: heightPx }}
      >
        <VisualizationRenderer
          spec={{
            ...spec,
            typography: { ...spec.typography, title: null },
            layout: { ...spec.layout, height: heightPx - 16, show_legend: false },
          }}
          rows={rows}
          className="pointer-events-none h-full"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="flex items-center justify-center bg-surface-muted font-mono text-2xl tracking-widest text-muted-foreground"
      style={{ height: heightPx }}
    >
      {CHART_TYPE_GLYPH[spec.chart_type] ?? "▭"}
    </div>
  );
}
