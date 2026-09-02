import type { TopLevelSpec } from "vega-lite";

import type { Encoding, VisualizationSpec } from "./spec";

/**
 * Compiles our VisualizationSpec into a Vega-Lite spec, given inline row data. The renderer
 * (Vega-Lite) never receives anything but declarative encodings -- no AI-generated code path
 * exists here or anywhere in the render chain.
 */

const CHART_TYPE_TO_MARK: Record<string, string> = {
  bar: "bar",
  grouped_bar: "bar",
  line: "line",
  area: "area",
  scatter: "point",
  histogram: "bar",
  box_plot: "boxplot",
  donut: "arc",
};

const AGGREGATION_MAP: Record<string, string | undefined> = {
  none: undefined,
  sum: "sum",
  mean: "mean",
  median: "median",
  count: "count",
  min: "min",
  max: "max",
};

function compileEncoding(encoding: Encoding | null | undefined): Record<string, unknown> | undefined {
  if (!encoding) return undefined;
  const aggregation = encoding.aggregation ? AGGREGATION_MAP[encoding.aggregation] : undefined;
  return {
    field: encoding.field,
    type: encoding.type,
    ...(aggregation ? { aggregate: aggregation } : {}),
    ...(encoding.label ? { title: encoding.label } : {}),
    ...(encoding.format ? { format: encoding.format } : {}),
  };
}

export function compileToVegaLite(
  spec: VisualizationSpec,
  rows: Record<string, unknown>[]
): TopLevelSpec {
  const mark = CHART_TYPE_TO_MARK[spec.chart_type] ?? "bar";

  const encoding: Record<string, unknown> = {};
  const x = compileEncoding(spec.encoding.x);
  const y = compileEncoding(spec.encoding.y);
  const color = compileEncoding(spec.encoding.color);
  const size = compileEncoding(spec.encoding.size);

  if (spec.chart_type === "donut") {
    if (size) encoding.theta = size;
    if (color) encoding.color = color;
  } else {
    if (x) encoding.x = x;
    if (y) encoding.y = y;
    if (color) encoding.color = color;
    if (size) encoding.size = size;
  }

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { values: rows },
    mark: spec.chart_type === "donut" ? { type: mark, innerRadius: 60 } : mark,
    encoding,
    width: spec.layout.width ?? "container",
    height: spec.layout.height ?? 320,
    title: spec.typography.title ?? undefined,
    config: {
      legend: { disable: !spec.layout.show_legend },
      axis: { grid: spec.layout.show_grid },
    },
  } as TopLevelSpec;
}
