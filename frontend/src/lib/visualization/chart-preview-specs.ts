/** One illustrative spec+fixture pair per registry chart type -- extracted from the old
 * /chart-gallery dev page rather than duplicated, since Chart Explorer needs exactly this same
 * "real spec drawn from data shaped for that chart family" content for its own previews. The
 * old page now just redirects; this is the surviving, shared source of that content. */

import type { Encodings, VisualizationSpec } from "@/lib/visualization/spec";
import * as fx from "./chart-fixtures";

function spec(chart_type: string, encoding: Encodings, title: string, height?: number): VisualizationSpec {
  return {
    chart_type,
    encoding,
    transformations: [],
    filters: [],
    annotations: [],
    theme: "minimal",
    typography: { title },
    layout: { show_legend: true, show_grid: true, ...(height ? { height } : {}) },
    metadata: { dataset_id: "gallery", dataset_version_id: "gallery" },
  };
}

const q = (field: string) => ({ field, type: "quantitative" as const });
const n = (field: string) => ({ field, type: "nominal" as const });
const t = (field: string) => ({ field, type: "temporal" as const });
const qSum = (field: string) => ({ field, type: "quantitative" as const, aggregation: "sum" as const });

export interface ChartPreviewEntry {
  spec: VisualizationSpec;
  rows: Record<string, unknown>[];
}

/** One entry per registry id -- keyed so a missing id is immediately visible. */
export const CHART_PREVIEW_SPECS: Record<string, ChartPreviewEntry> = {
  bar: { spec: spec("bar", { x: n("region"), y: qSum("revenue") }, "Column Chart"), rows: fx.categorical },
  stacked_bar: {
    spec: spec("stacked_bar", { x: n("region"), y: qSum("revenue"), color: n("product") }, "Stacked Column Chart"),
    rows: fx.categorical,
  },
  grouped_bar: {
    spec: spec("grouped_bar", { x: n("region"), y: qSum("revenue"), color: n("product") }, "Grouped Bar Chart"),
    rows: fx.categorical,
  },
  horizontal_bar: {
    spec: spec("horizontal_bar", { x: n("region"), y: qSum("revenue") }, "Bar Chart (horizontal)"),
    rows: fx.categorical,
  },
  stacked_bar_horizontal: {
    spec: spec("stacked_bar_horizontal", { x: n("region"), y: qSum("revenue"), color: n("product") }, "Stacked Bar Chart"),
    rows: fx.categorical,
  },
  sorted_bar: {
    spec: spec("sorted_bar", { x: n("region"), y: qSum("revenue") }, "Sorted Bar Chart"),
    rows: fx.categorical,
  },
  lollipop: { spec: spec("lollipop", { x: n("region"), y: qSum("revenue") }, "Lollipop Chart"), rows: fx.categorical },
  bullet: {
    spec: spec("bullet", { y: n("region"), x: qSum("revenue"), measure2: qSum("target") }, "Bullet Chart"),
    rows: fx.categorical,
  },
  radar: {
    spec: spec("radar", { x: n("metric"), y: q("value"), color: n("team") }, "Radar / Spider Chart"),
    rows: fx.radar,
  },

  line: { spec: spec("line", { x: t("date"), y: q("revenue") }, "Line Chart"), rows: fx.timeSeries },
  area: { spec: spec("area", { x: t("date"), y: q("revenue") }, "Area Chart"), rows: fx.timeSeries },
  sparkline: {
    spec: spec("sparkline", { x: t("date"), y: q("revenue") }, "Sparkline Chart", 70),
    rows: fx.timeSeries,
  },
  candlestick: {
    spec: spec(
      "candlestick",
      { x: t("day"), open: q("open"), high: q("high"), low: q("low"), close: q("close") },
      "Candlestick Chart"
    ),
    rows: fx.ohlc,
  },
  ohlc: {
    spec: spec(
      "ohlc",
      { x: t("day"), open: q("open"), high: q("high"), low: q("low"), close: q("close") },
      "Open-High-Low-Close Chart"
    ),
    rows: fx.ohlc,
  },
  ribbon: {
    spec: spec("ribbon", { x: n("quarter"), y: qSum("score"), color: n("team") }, "Ribbon Chart"),
    rows: fx.rankedOverTime,
  },
  bump: {
    spec: spec("bump", { x: n("quarter"), y: qSum("score"), color: n("team") }, "Bump Chart"),
    rows: fx.rankedOverTime,
  },
  line_column: {
    spec: spec("line_column", { x: t("date"), y: q("revenue"), measure2: q("margin") }, "Line and Column Chart"),
    rows: fx.timeSeries,
  },

  pie: { spec: spec("pie", { color: n("region"), size: qSum("revenue") }, "Pie Chart"), rows: fx.categorical },
  donut: { spec: spec("donut", { color: n("region"), size: qSum("revenue") }, "Donut Chart"), rows: fx.categorical },
  treemap: {
    spec: spec("treemap", { detail: n("department"), color: n("category"), size: qSum("revenue") }, "Treemap"),
    rows: fx.hierarchy,
  },
  sunburst: {
    spec: spec("sunburst", { detail: n("department"), color: n("category"), size: qSum("revenue") }, "Sunburst Chart"),
    rows: fx.hierarchy,
  },
  waterfall: {
    spec: spec("waterfall", { x: n("stage"), y: q("delta") }, "Waterfall Chart"),
    rows: fx.waterfall,
  },

  histogram: { spec: spec("histogram", { x: q("score") }, "Histogram"), rows: fx.distribution },
  box_plot: {
    spec: spec("box_plot", { x: n("group"), y: q("score") }, "Box and Whisker Plot"),
    rows: fx.distribution,
  },
  violin: { spec: spec("violin", { x: n("group"), y: q("score") }, "Violin Plot"), rows: fx.distribution },
  marimekko: {
    spec: spec("marimekko", { x: n("region"), y: n("product"), size: qSum("revenue") }, "Marimekko / Mosaic Chart"),
    rows: fx.categorical,
  },

  scatter: { spec: spec("scatter", { x: q("units"), y: q("revenue") }, "Scatter Plot"), rows: fx.categorical },
  bubble: {
    spec: spec("bubble", { x: q("units"), y: q("revenue"), size: q("target") }, "Bubble Chart"),
    rows: fx.categorical,
  },
  heatmap: {
    spec: spec("heatmap", { x: n("region"), y: n("product"), color: qSum("revenue") }, "Heatmap / Matrix"),
    rows: fx.categorical,
  },

  network: {
    spec: spec("network", { x: n("from"), y: n("to"), size: q("weight") }, "Network Diagram", 400),
    rows: fx.flows,
  },
  chord: {
    spec: spec("chord", { x: n("from"), y: n("to"), size: q("weight") }, "Chord Diagram", 400),
    rows: fx.flows,
  },
  sankey: {
    spec: spec("sankey", { x: n("from"), y: n("to"), size: q("weight") }, "Sankey Diagram", 400),
    rows: fx.flows,
  },
  funnel: { spec: spec("funnel", { x: n("stage"), y: q("count") }, "Funnel Chart", 320), rows: fx.funnel },
  gantt: {
    spec: spec("gantt", { x: t("start"), x2: t("end"), y: n("task"), color: n("phase") }, "Gantt Chart"),
    rows: fx.tasks,
  },
  decomposition_tree: {
    spec: spec(
      "decomposition_tree",
      { detail: n("department"), color: n("category"), size: qSum("revenue") },
      "Decomposition Tree"
    ),
    rows: fx.hierarchy,
  },

  choropleth: {
    spec: spec("choropleth", { x: n("country"), color: qSum("value") }, "Choropleth / Filled Map"),
    rows: fx.countries,
  },
  bubble_map: {
    spec: spec("bubble_map", { x: q("lon"), y: q("lat"), size: q("volume") }, "Bubble Map Chart"),
    rows: fx.cities,
  },
  flow_map: {
    spec: spec(
      "flow_map",
      { x: q("oLon"), y: q("oLat"), x2: q("dLon"), y2: q("dLat"), size: q("volume") },
      "Flow Map"
    ),
    rows: fx.routes,
  },

  kpi: {
    spec: spec("kpi", { x: t("date"), size: qSum("revenue") }, "Total revenue"),
    rows: fx.timeSeries,
  },
  gauge: {
    spec: spec("gauge", { size: qSum("revenue"), measure2: qSum("target") }, "Revenue vs target"),
    rows: fx.categorical,
  },
  table: { spec: spec("table", {}, "Data Table"), rows: fx.categorical },
  matrix: {
    spec: spec("matrix", { x: n("product"), y: n("region"), size: qSum("revenue") }, "Matrix"),
    rows: fx.categorical,
  },
};
