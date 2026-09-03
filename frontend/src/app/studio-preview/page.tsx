import { AppShell } from "@/components/layout/app-shell";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { SectionHeading, Subtitle } from "@/components/ui/typography";
import type { VisualizationSpec } from "@/lib/visualization/spec";

const sampleRows = [
  { region: "North", revenue: 5241.35 },
  { region: "South", revenue: 2405.6 },
  { region: "East", revenue: 2960.25 },
  { region: "West", revenue: 3010.0 },
];

const barSpec: VisualizationSpec = {
  chart_type: "bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  transformations: [],
  filters: [],
  annotations: [],
  theme: "minimal",
  typography: { title: "Revenue by region" },
  layout: { show_legend: true, show_grid: true },
  metadata: { dataset_id: "sample", dataset_version_id: "sample" },
};

const timeSeriesRows = [
  { date: "2024-01-01", revenue: 1200.5 },
  { date: "2024-01-02", revenue: 980.0 },
  { date: "2024-01-03", revenue: 2150.75 },
  { date: "2024-01-04", revenue: 760.25 },
  { date: "2024-01-05", revenue: 3010.0 },
];

const lineSpec: VisualizationSpec = {
  chart_type: "line",
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "revenue", type: "quantitative" },
  },
  transformations: [],
  filters: [],
  annotations: [],
  theme: "minimal",
  typography: { title: "Revenue over time" },
  layout: { show_legend: true, show_grid: true },
  metadata: { dataset_id: "sample", dataset_version_id: "sample" },
};

function baseSpec(overrides: Partial<VisualizationSpec>): VisualizationSpec {
  return {
    chart_type: "bar",
    encoding: {},
    transformations: [],
    filters: [],
    annotations: [],
    theme: "minimal",
    typography: {},
    layout: { show_legend: true, show_grid: true },
    metadata: { dataset_id: "sample", dataset_version_id: "sample" },
    ...overrides,
  };
}

const groupedRows = [
  { region: "North", product: "Widget", revenue: 1200 },
  { region: "North", product: "Gadget", revenue: 900 },
  { region: "South", product: "Widget", revenue: 800 },
  { region: "South", product: "Gadget", revenue: 1400 },
];

const horizontalBarSpec = baseSpec({
  chart_type: "horizontal_bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  typography: { title: "Horizontal Bar (Bar Chart #3)" },
});

const stackedBarSpec = baseSpec({
  chart_type: "stacked_bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
    color: { field: "product", type: "nominal" },
  },
  typography: { title: "Stacked Column (#2)" },
});

const stackedBarHorizontalSpec = baseSpec({
  chart_type: "stacked_bar_horizontal",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
    color: { field: "product", type: "nominal" },
  },
  typography: { title: "Stacked Bar, horizontal (#18)" },
});

const sortedBarSpec = baseSpec({
  chart_type: "sorted_bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  typography: { title: "Sorted Bar (#14)" },
});

const pieSpec = baseSpec({
  chart_type: "pie",
  encoding: {
    color: { field: "region", type: "nominal" },
    size: { field: "revenue", type: "quantitative" },
  },
  typography: { title: "Pie (#16)" },
});

const waterfallRows = [
  { stage: "Starting cash", delta: 1000 },
  { stage: "Q1 revenue", delta: 500 },
  { stage: "Q1 costs", delta: -300 },
  { stage: "Q2 revenue", delta: 700 },
  { stage: "Q2 costs", delta: -400 },
];

const waterfallSpec = baseSpec({
  chart_type: "waterfall",
  encoding: {
    x: { field: "stage", type: "nominal" },
    y: { field: "delta", type: "quantitative" },
  },
  typography: { title: "Waterfall (#21) -- real cumulative-total transform" },
});

const bubbleSpec = baseSpec({
  chart_type: "bubble",
  encoding: {
    x: { field: "revenue", type: "quantitative" },
    y: { field: "revenue", type: "quantitative" },
    size: { field: "revenue", type: "quantitative" },
  },
  typography: { title: "Bubble (#27)" },
});

const heatmapSpec = baseSpec({
  chart_type: "heatmap",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "product", type: "nominal" },
    color: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  typography: { title: "Heatmap (#28)" },
});

const sparklineSpec = baseSpec({
  chart_type: "sparkline",
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "revenue", type: "quantitative" },
  },
  layout: { show_legend: false, show_grid: false, height: 60 },
});

const kpiSpec = baseSpec({
  chart_type: "kpi",
  encoding: {
    x: { field: "date", type: "temporal" },
    size: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  typography: { title: "Total revenue (#38)" },
});

const tableSpec = baseSpec({
  chart_type: "table",
  typography: { title: "Data Table (#40)" },
});

export default function StudioPreviewPage() {
  return (
    <AppShell>
      <section className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <div>
          <SectionHeading>Visualization renderer smoke test</SectionHeading>
          <Subtitle>Compiles a VisualizationSpec to Vega-Lite and renders it.</Subtitle>
        </div>
        <VisualizationRenderer spec={barSpec} rows={sampleRows} />
        <VisualizationRenderer spec={lineSpec} rows={timeSeriesRows} />

        <div>
          <SectionHeading>New chart types (this session&apos;s 41-type audit)</SectionHeading>
        </div>
        <VisualizationRenderer spec={horizontalBarSpec} rows={sampleRows} />
        <VisualizationRenderer spec={stackedBarSpec} rows={groupedRows} />
        <VisualizationRenderer spec={stackedBarHorizontalSpec} rows={groupedRows} />
        <VisualizationRenderer spec={sortedBarSpec} rows={sampleRows} />
        <VisualizationRenderer spec={pieSpec} rows={sampleRows} />
        <VisualizationRenderer spec={waterfallSpec} rows={waterfallRows} />
        <VisualizationRenderer spec={bubbleSpec} rows={sampleRows} />
        <VisualizationRenderer spec={heatmapSpec} rows={groupedRows} />
        <div style={{ width: 200 }}>
          <VisualizationRenderer spec={sparklineSpec} rows={timeSeriesRows} />
        </div>
        <VisualizationRenderer spec={kpiSpec} rows={timeSeriesRows} />
        <VisualizationRenderer spec={tableSpec} rows={groupedRows} />
      </section>
    </AppShell>
  );
}
