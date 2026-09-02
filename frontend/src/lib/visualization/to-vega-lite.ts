import type { TopLevelSpec } from "vega-lite";

import type { ThemeTokens } from "@/lib/api/theme";

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

function rangeForPaletteType(theme: ThemeTokens): string[] {
  if (theme.palette_type === "sequential") return theme.sequential_range;
  if (theme.palette_type === "diverging") return theme.diverging_range;
  return theme.categorical_colors;
}

export function compileToVegaLite(
  spec: VisualizationSpec,
  rows: Record<string, unknown>[],
  theme?: ThemeTokens
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

  const markColor = theme?.categorical_colors[0];
  const markConfig =
    spec.chart_type === "donut" ? { type: mark, innerRadius: 60 } : { type: mark };

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: { values: rows },
    mark: markColor && !color ? { ...markConfig, color: markColor } : markConfig,
    encoding,
    width: spec.layout.width ?? "container",
    height: spec.layout.height ?? 320,
    title: spec.typography.title ?? undefined,
    background: theme?.background,
    config: {
      legend: { disable: !spec.layout.show_legend },
      axis: {
        grid: spec.layout.show_grid,
        gridColor: theme?.grid,
        domainColor: theme?.border,
        labelColor: theme?.foreground,
        titleColor: theme?.foreground,
      },
      title: { color: theme?.foreground, font: theme?.headline_font },
      range: theme ? { category: rangeForPaletteType(theme) } : undefined,
    },
  } as TopLevelSpec;
}
