/**
 * Per-chart-type Vega-Lite builders for chart types that need more than a single mark +
 * encoding mapping (layers, window transforms, or precomputed geometry).
 *
 * Registered in a lookup keyed by chart_type rather than a growing if/else chain, so adding a
 * chart type is a new entry here plus a registry flag -- never an edit to a central conditional.
 *
 * Every builder here is mathematically exact: cumulative totals, ranks, and Marimekko cell
 * geometry are computed by real transforms (Vega-Lite window/joinaggregate) or by explicit
 * deterministic arithmetic, never approximated to "look about right".
 */

import type { Encodings } from "./spec";

export interface BuilderContext {
  encoding: Encodings;
  /** Compiled Vega-Lite encoding objects, already aggregation/label-resolved. */
  compiled: Record<string, CompiledEncoding | undefined>;
  rows: Record<string, unknown>[];
  markColor?: string;
  positiveColor?: string;
  negativeColor?: string;
}

export interface CompiledEncoding {
  field: string;
  type: string;
  aggregate?: string;
  title?: string;
  [key: string]: unknown;
}

export interface BuiltSpec {
  /** Replaces the default single-mark body. */
  layer?: Record<string, unknown>[];
  mark?: Record<string, unknown> | string;
  encoding?: Record<string, unknown>;
  transform?: Record<string, unknown>[];
  data?: { values: Record<string, unknown>[] };
  resolve?: Record<string, unknown>;
}

const DEFAULT_UP = "#2f6b4f";
const DEFAULT_DOWN = "#b5432a";

/** Lollipop: a stem from the zero baseline to the value, plus an endpoint marker. Geometrically
 * a bar chart with the bar's area replaced by a 1px rule -- same encoding, same scale, so the
 * value position is identical to the equivalent bar. */
function buildLollipop(ctx: BuilderContext): BuiltSpec {
  const { compiled, markColor } = ctx;
  const cat = compiled.x;
  const val = compiled.y;
  const color = markColor ?? DEFAULT_DOWN;
  return {
    layer: [
      {
        mark: { type: "rule", color, size: 2 },
        encoding: { x: cat, y: val, y2: { datum: 0 } },
      },
      {
        mark: { type: "point", filled: true, size: 140, color },
        encoding: { x: cat, y: val },
      },
    ],
  };
}

/** Bullet: a measure bar against a light "full range" backdrop, with an optional target tick.
 * The backdrop's extent is the real max of the measure across categories (joinaggregate), not a
 * hardcoded axis bound, so the bar-to-backdrop ratio is a true proportion of the observed range. */
function buildBullet(ctx: BuilderContext): BuiltSpec {
  const { compiled, markColor } = ctx;
  const cat = compiled.y ?? compiled.x;
  const val = compiled.x?.type === "quantitative" ? compiled.x : compiled.y;
  const target = compiled.measure2;
  if (!val) return {};

  const layers: Record<string, unknown>[] = [
    {
      mark: { type: "bar", color: "#e5e2db", size: 22 },
      encoding: { x: { field: "__range_max", type: "quantitative", title: val.title }, y: cat },
    },
    {
      mark: { type: "bar", color: markColor ?? "#1a1815", size: 9 },
      encoding: { x: val, y: cat },
    },
  ];
  if (target) {
    layers.push({
      mark: { type: "tick", color: DEFAULT_DOWN, thickness: 3, size: 26 },
      encoding: { x: target, y: cat },
    });
  }
  return {
    transform: [{ joinaggregate: [{ op: "max", field: val.field, as: "__range_max" }] }],
    layer: layers,
  };
}

/** Bump: rank over time. The rank is computed by a real Vega-Lite window transform partitioned
 * by period and ordered by the measure -- so it is the true competitive rank within each period,
 * not the raw measure re-labelled. The y scale is reversed so rank 1 sits at the top. */
function buildBump(ctx: BuilderContext): BuiltSpec {
  const { compiled, encoding } = ctx;
  const time = compiled.x;
  const measure = compiled.y;
  const series = compiled.color;
  if (!time || !measure || !series) return {};

  const rankEncoding = {
    field: "__rank",
    type: "quantitative",
    title: "Rank",
    scale: { reverse: true },
    axis: { tickMinStep: 1 },
  };
  return {
    transform: [
      {
        window: [{ op: "rank", as: "__rank" }],
        groupby: [encoding.x!.field],
        sort: [{ field: measure.field, order: "descending" }],
      },
    ],
    layer: [
      { mark: { type: "line", strokeWidth: 3 }, encoding: { x: time, y: rankEncoding, color: series } },
      { mark: { type: "point", filled: true, size: 110 }, encoding: { x: time, y: rankEncoding, color: series } },
    ],
  };
}

/** Ribbon: stacked bands over an ordered dimension whose vertical thickness is the measure --
 * the ranking-flow reading comes from ordering each period's stack by value (descending), which
 * a plain stacked area does not do. */
function buildRibbon(ctx: BuilderContext): BuiltSpec {
  const { compiled, encoding } = ctx;
  const time = compiled.x;
  const measure = compiled.y;
  const series = compiled.color;
  if (!time || !measure || !series) return {};
  return {
    mark: { type: "area", interpolate: "monotone", opacity: 0.9 },
    encoding: {
      x: time,
      y: { ...measure, stack: "zero" },
      color: series,
      order: { field: measure.field, sort: "descending" },
      tooltip: [time, series, measure],
    },
    transform: [{ filter: `isValid(datum["${encoding.color!.field}"])` }],
  };
}

/**
 * Marimekko: both axes are proportional -- column width is each x-category's share of the grand
 * total, and segment height is that segment's share within its column. Vega-Lite has no
 * variable-width bar, so the cell rectangles are computed here explicitly and drawn as `rect`
 * marks on two continuous 0-100% scales. Area therefore encodes the true joint proportion.
 */
export function buildMarimekkoRows(
  rows: Record<string, unknown>[],
  xField: string,
  yField: string,
  sizeField: string
): Record<string, unknown>[] {
  const byX = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const xv = String(row[xField] ?? "");
    const yv = String(row[yField] ?? "");
    const v = Number(row[sizeField]);
    if (!Number.isFinite(v)) continue;
    if (!byX.has(xv)) byX.set(xv, new Map());
    const inner = byX.get(xv)!;
    inner.set(yv, (inner.get(yv) ?? 0) + v);
  }

  const columnTotals = [...byX.entries()].map(([xv, inner]) => ({
    xv,
    total: [...inner.values()].reduce((a, b) => a + b, 0),
    inner,
  }));
  const grandTotal = columnTotals.reduce((a, c) => a + c.total, 0);
  if (grandTotal <= 0) return [];

  const out: Record<string, unknown>[] = [];
  let xCursor = 0;
  for (const { xv, total, inner } of columnTotals) {
    const width = (total / grandTotal) * 100;
    let yCursor = 0;
    for (const [yv, value] of inner.entries()) {
      const height = total > 0 ? (value / total) * 100 : 0;
      out.push({
        [xField]: xv,
        [yField]: yv,
        [sizeField]: value,
        __x0: xCursor,
        __x1: xCursor + width,
        __y0: yCursor,
        __y1: yCursor + height,
        __share: (value / grandTotal) * 100,
      });
      yCursor += height;
    }
    xCursor += width;
  }
  return out;
}

function buildMarimekko(ctx: BuilderContext): BuiltSpec {
  const { encoding, rows, compiled } = ctx;
  const xField = encoding.x?.field;
  const yField = encoding.y?.field;
  const sizeField = encoding.size?.field;
  if (!xField || !yField || !sizeField) return {};

  return {
    data: { values: buildMarimekkoRows(rows, xField, yField, sizeField) },
    mark: { type: "rect", stroke: "#ffffff", strokeWidth: 1 },
    encoding: {
      x: { field: "__x0", type: "quantitative", title: xField, axis: { format: ".0f", labelExpr: "datum.value + '%'" } },
      x2: { field: "__x1" },
      y: { field: "__y0", type: "quantitative", title: yField, axis: { format: ".0f", labelExpr: "datum.value + '%'" } },
      y2: { field: "__y1" },
      color: compiled.color ?? { field: yField, type: "nominal" },
      tooltip: [
        { field: xField, type: "nominal" },
        { field: yField, type: "nominal" },
        { field: sizeField, type: "quantitative" },
        { field: "__share", type: "quantitative", title: "% of total", format: ".2f" },
      ],
    },
  };
}

/** Gantt: a task bar spanning its real start->end interval on a temporal axis. Uses the x/x2
 * range channels, so bar length is the actual duration rather than a value-encoded magnitude. */
function buildGantt(ctx: BuilderContext): BuiltSpec {
  const { compiled } = ctx;
  const start = compiled.x;
  const end = compiled.x2;
  const task = compiled.y;
  if (!start || !end || !task) return {};
  return {
    mark: { type: "bar", cornerRadius: 3, height: { band: 0.6 } },
    encoding: {
      x: start,
      x2: end,
      y: task,
      ...(compiled.color ? { color: compiled.color } : {}),
      tooltip: [task, start, end],
    },
  };
}

/** Candlestick: high-low wick as a rule, open-close body as a bar, coloured by direction.
 * Body spans open..close via y/y2 so an up-day and a down-day render the same body extent --
 * direction is carried by colour, exactly as in standard financial charting. */
function buildCandlestick(ctx: BuilderContext): BuiltSpec {
  const { compiled, encoding, positiveColor, negativeColor } = ctx;
  const t = compiled.x;
  const { open, high, low, close } = compiled;
  if (!t || !open || !high || !low || !close) return {};

  const directionColor = {
    condition: {
      test: `datum["${encoding.open!.field}"] < datum["${encoding.close!.field}"]`,
      value: positiveColor ?? DEFAULT_UP,
    },
    value: negativeColor ?? DEFAULT_DOWN,
  };
  return {
    layer: [
      { mark: { type: "rule" }, encoding: { x: t, y: low, y2: high, color: directionColor } },
      {
        mark: { type: "bar", size: 6 },
        encoding: { x: t, y: open, y2: close, color: directionColor },
      },
    ],
  };
}

/** OHLC bar: the same underlying data as a candlestick but the classic tick geometry -- a
 * vertical high-low line with open as a left-facing tick and close as a right-facing tick.
 * Kept a separate builder because the geometry, not just the styling, differs. */
function buildOHLC(ctx: BuilderContext): BuiltSpec {
  const { compiled, encoding, positiveColor, negativeColor } = ctx;
  const t = compiled.x;
  const { open, high, low, close } = compiled;
  if (!t || !open || !high || !low || !close) return {};

  const directionColor = {
    condition: {
      test: `datum["${encoding.open!.field}"] < datum["${encoding.close!.field}"]`,
      value: positiveColor ?? DEFAULT_UP,
    },
    value: negativeColor ?? DEFAULT_DOWN,
  };
  return {
    layer: [
      { mark: { type: "rule", size: 1.5 }, encoding: { x: t, y: low, y2: high, color: directionColor } },
      {
        mark: { type: "tick", orient: "horizontal", size: 9, thickness: 1.5, xOffset: -5 },
        encoding: { x: t, y: open, color: directionColor },
      },
      {
        mark: { type: "tick", orient: "horizontal", size: 9, thickness: 1.5, xOffset: 5 },
        encoding: { x: t, y: close, color: directionColor },
      },
    ],
  };
}

/** Line and column: two measures on independently-resolved y scales -- columns for the primary
 * magnitude, a line for the secondary (typically a rate or ratio whose units differ). Scales are
 * explicitly independent and both axes are titled, so the dual-axis reading is unambiguous. */
function buildLineColumn(ctx: BuilderContext): BuiltSpec {
  const { compiled, markColor } = ctx;
  const x = compiled.x;
  const columns = compiled.y;
  const line = compiled.measure2;
  if (!x || !columns || !line) return {};
  return {
    layer: [
      {
        mark: { type: "bar", color: markColor ?? "#4c78a8" },
        encoding: { x, y: { ...columns, axis: { title: columns.title ?? columns.field } } },
      },
      {
        mark: { type: "line", color: DEFAULT_DOWN, strokeWidth: 2.5, point: true },
        encoding: { x, y: { ...line, axis: { title: line.title ?? line.field } } },
      },
    ],
    resolve: { scale: { y: "independent" } },
  };
}

export const VEGA_BUILDERS: Record<string, (ctx: BuilderContext) => BuiltSpec> = {
  lollipop: buildLollipop,
  bullet: buildBullet,
  bump: buildBump,
  ribbon: buildRibbon,
  marimekko: buildMarimekko,
  gantt: buildGantt,
  candlestick: buildCandlestick,
  ohlc: buildOHLC,
  line_column: buildLineColumn,
};
