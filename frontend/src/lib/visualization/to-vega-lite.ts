import type { TopLevelSpec } from "vega-lite";

import type { ThemeTokens } from "@/lib/api/theme";

import { buildAnnotationLayers } from "./annotation-layers";
import type { Annotation, Encoding, VisualizationSpec } from "./spec";
import { type CompiledEncoding, VEGA_BUILDERS } from "./vega-builders";

/**
 * Compiles our VisualizationSpec into a Vega-Lite spec, given inline row data. The renderer
 * (Vega-Lite) never receives anything but declarative encodings -- no AI-generated code path
 * exists here or anywhere in the render chain.
 */

const CHART_TYPE_TO_MARK: Record<string, string> = {
  bar: "bar",
  grouped_bar: "bar",
  stacked_bar: "bar",
  horizontal_bar: "bar",
  stacked_bar_horizontal: "bar",
  sorted_bar: "bar",
  waterfall: "bar",
  line: "line",
  area: "area",
  sparkline: "line",
  scatter: "point",
  bubble: "point",
  histogram: "bar",
  box_plot: "boxplot",
  donut: "arc",
  pie: "arc",
  heatmap: "rect",
};

/** Chart types whose x/y are swapped relative to their vertical counterpart -- a horizontal
 * bar is mathematically identical to a vertical one with the two channels exchanged, so this
 * is a real, correct transformation, not an approximation. */
const HORIZONTAL_ORIENTATION_CHARTS = new Set(["horizontal_bar", "stacked_bar_horizontal"]);

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

/** Every annotation, regardless of whether it also renders on canvas -- the accessible text
 * list is a supplement, not a fallback for what didn't make it onto the chart. A sighted user
 * sees the reference line; a screen-reader user needs the same information some other way, so
 * reference_line/callout/label all appear here too now (previously reference_line was
 * excluded on the assumption that "visible on canvas" meant "doesn't need text," which left
 * screen-reader users with no representation of it at all). */
export function textAnnotations(spec: VisualizationSpec): Annotation[] {
  return spec.annotations;
}

/**
 * Top-level sizing/title/theme config shared by every chart type, single-mark or layered.
 *
 * Vega's runtime merges this with its own built-in defaults (including the named color-scheme
 * table for "category"/"heatmap"/"diverging"). Setting a key to an explicit `undefined` --
 * rather than omitting it -- overwrites/wipes that default during the merge, which previously
 * broke every chart with a color encoding when no theme was supplied ("Unrecognized scale range
 * value"). `range` is therefore spread in conditionally rather than always present.
 */
function buildSharedTopLevel(
  spec: VisualizationSpec,
  theme?: ThemeTokens
): Record<string, unknown> {
  return {
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
      ...(theme ? { range: { category: rangeForPaletteType(theme) } } : {}),
    },
  };
}

export function compileToVegaLite(
  spec: VisualizationSpec,
  rows: Record<string, unknown>[],
  theme?: ThemeTokens
): TopLevelSpec {
  const mark = CHART_TYPE_TO_MARK[spec.chart_type] ?? "bar";
  const isPieFamily = spec.chart_type === "donut" || spec.chart_type === "pie";
  const isHorizontal = HORIZONTAL_ORIENTATION_CHARTS.has(spec.chart_type);

  const encoding: Record<string, unknown> = {};
  let x = compileEncoding(spec.encoding.x);
  let y = compileEncoding(spec.encoding.y);
  const color = compileEncoding(spec.encoding.color);
  const size = compileEncoding(spec.encoding.size);

  // Chart types whose geometry is more than "one mark + channel map" (layers, window
  // transforms, or precomputed cell rectangles) are delegated to a builder keyed by chart_type,
  // so this function never grows a per-chart conditional chain.
  const builder = VEGA_BUILDERS[spec.chart_type];
  if (builder) {
    const built = builder({
      encoding: spec.encoding,
      compiled: {
        x,
        y,
        color,
        size,
        detail: compileEncoding(spec.encoding.detail),
        x2: compileEncoding(spec.encoding.x2),
        y2: compileEncoding(spec.encoding.y2),
        measure2: compileEncoding(spec.encoding.measure2),
        open: compileEncoding(spec.encoding.open),
        high: compileEncoding(spec.encoding.high),
        low: compileEncoding(spec.encoding.low),
        close: compileEncoding(spec.encoding.close),
      } as Record<string, CompiledEncoding | undefined>,
      rows,
      markColor: theme?.categorical_colors[0],
      positiveColor: theme?.positive_color,
      negativeColor: theme?.negative_color,
    });
    const sharedTopLevel = buildSharedTopLevel(spec, theme);
    const annotationLayers = buildAnnotationLayers(spec, rows, theme);
    if (annotationLayers.length === 0) {
      // Unchanged from before this batch when there's nothing to layer on top of.
      return { ...sharedTopLevel, data: { values: rows }, ...built } as TopLevelSpec;
    }
    // Builders return either `layer` (already multi-layer, e.g. lollipop) or a single
    // `mark`/`encoding` -- normalize to a layer array only in this branch, so the
    // no-annotation case above never pays for or risks this reshaping.
    const builtLayers = built.layer ?? [
      {
        ...(built.data ? { data: built.data } : {}),
        ...(built.transform ? { transform: built.transform } : {}),
        mark: built.mark,
        encoding: built.encoding,
      },
    ];
    return {
      ...sharedTopLevel,
      data: { values: rows },
      ...(built.resolve ? { resolve: built.resolve } : {}),
      layer: [...builtLayers, ...annotationLayers],
    } as unknown as TopLevelSpec;
  }

  // A horizontal bar is a vertical bar with x/y exchanged -- genuinely correct, not a visual
  // approximation, since Vega-Lite's bar mark is symmetric in this respect.
  if (isHorizontal) {
    [x, y] = [y, x];
  }

  if (spec.chart_type === "sorted_bar" && x && y) {
    const categoricalEncoding = x.type === "quantitative" ? y : x;
    categoricalEncoding.sort = spec.sort?.descending === false ? "y" : "-y";
  }

  if (isPieFamily) {
    if (size) encoding.theta = size;
    if (color) encoding.color = color;
  } else if (spec.chart_type === "heatmap") {
    if (x) encoding.x = x;
    if (y) encoding.y = y;
    if (color) encoding.color = { ...color, type: "quantitative" };
  } else {
    if (x) encoding.x = x;
    if (y) encoding.y = y;
    if (color) encoding.color = color;
    if (size) encoding.size = size;
  }

  if (spec.chart_type === "sparkline") {
    encoding.x = { ...(encoding.x as Record<string, unknown>), axis: null };
    encoding.y = { ...(encoding.y as Record<string, unknown>), axis: null };
  }

  const markColor = theme?.categorical_colors[0];
  const markConfig = isPieFamily
    ? { type: mark, innerRadius: spec.chart_type === "donut" ? 60 : 0 }
    : { type: mark };

  // Waterfall: a real running-cumulative-total transform computed by Vega-Lite itself (a
  // declarative window aggregate, not a client-side approximation) -- `start` is the
  // cumulative total *before* this row, `cumulative` is the total *after*, so each bar spans
  // exactly the right range regardless of row order in the data.
  const waterfallTransform =
    spec.chart_type === "waterfall" && y
      ? [
          { window: [{ op: "sum", field: y.field, as: "cumulative" }], frame: [null, 0] },
          { calculate: `datum.cumulative - datum.${y.field}`, as: "start" },
        ]
      : undefined;
  if (waterfallTransform && y) {
    encoding.y = { field: "start", type: "quantitative", title: y.title ?? y.field };
    encoding.y2 = { field: "cumulative" };
  }

  const baseLayer = {
    data: { values: rows },
    ...(waterfallTransform ? { transform: waterfallTransform } : {}),
    mark: markColor && !color ? { ...markConfig, color: markColor } : markConfig,
    encoding,
  };
  const annotationLayers = buildAnnotationLayers(spec, rows, theme);

  const sharedTopLevel = buildSharedTopLevel(spec, theme);

  if (annotationLayers.length === 0) {
    return { ...sharedTopLevel, ...baseLayer } as TopLevelSpec;
  }

  return {
    ...sharedTopLevel,
    layer: [baseLayer, ...annotationLayers],
  } as TopLevelSpec;
}
