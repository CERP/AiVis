import type { TopLevelSpec } from "vega-lite";

import type { ThemeTokens } from "@/lib/api/theme";

import type { Annotation, Encoding, VisualizationSpec } from "./spec";

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

/** Reference-line annotations render as an actual chart overlay (a Vega-Lite layer) since
 * that only needs one fixed axis value, no scale-domain guesswork. Text-based annotation
 * types (callout/label/highlighted_region/source_note) render as accessible HTML alongside
 * the chart instead of SVG text -- more robust to position and better for screen readers than
 * fighting Vega-Lite's layout engine for pixel-perfect text placement. */
function buildReferenceLineLayers(
  spec: VisualizationSpec,
  color: string | undefined
): Record<string, unknown>[] {
  const layers: Record<string, unknown>[] = [];
  for (const annotation of spec.annotations) {
    if (annotation.type !== "reference_line") continue;
    if (annotation.target_field == null || annotation.target_value == null) continue;

    const axis: "x" | "y" | null =
      spec.encoding.x?.field === annotation.target_field
        ? "x"
        : spec.encoding.y?.field === annotation.target_field
          ? "y"
          : null;
    if (!axis) continue;

    const encodingType = spec.encoding[axis]?.type ?? "quantitative";
    layers.push({
      data: { values: [{ value: annotation.target_value }] },
      mark: { type: "rule", strokeDash: [4, 4], color: color ?? "#b5432a" },
      encoding: {
        [axis]: { field: "value", type: encodingType },
      },
    });
  }
  return layers;
}

export function textAnnotations(spec: VisualizationSpec): Annotation[] {
  return spec.annotations.filter((a) => a.type !== "reference_line");
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

  const baseLayer = {
    data: { values: rows },
    mark: markColor && !color ? { ...markConfig, color: markColor } : markConfig,
    encoding,
  };
  const referenceLineLayers = buildReferenceLineLayers(spec, theme?.negative_color);

  const sharedTopLevel = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: spec.layout.width ?? "container",
    height: spec.layout.height ?? 320,
    title: spec.typography.title ?? undefined,
    background: theme?.background,
    config: {
      legend: {
        disable: !spec.layout.show_legend,
        titleColor: theme?.foreground,
        titleFont: theme?.headline_font,
        titleFontWeight: "bold" as const,
        titleFontSize: 12,
        labelColor: theme?.foreground,
        labelFont: theme?.body_font,
        labelFontSize: 11,
        symbolSize: 80,
        orient: "top" as const,
      },
      axis: {
        grid: spec.layout.show_grid,
        gridColor: theme?.grid,
        gridOpacity: 0.6,
        domainColor: theme?.border,
        tickColor: theme?.border,
        labelColor: theme?.foreground,
        labelFont: theme?.body_font,
        labelFontSize: 11,
        titleColor: theme?.foreground,
        titleFont: theme?.body_font,
        titleFontWeight: "bold" as const,
        titleFontSize: 12,
        titlePadding: 12,
      },
      title: {
        color: theme?.foreground,
        font: theme?.headline_font,
        fontWeight: "bold" as const,
        fontSize: 16,
        anchor: "start" as const,
      },
      range: theme ? { category: rangeForPaletteType(theme) } : undefined,
    },
  };

  if (referenceLineLayers.length === 0) {
    return { ...sharedTopLevel, ...baseLayer } as TopLevelSpec;
  }

  return {
    ...sharedTopLevel,
    layer: [baseLayer, ...referenceLineLayers],
  } as TopLevelSpec;
}
