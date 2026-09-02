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
      </section>
    </AppShell>
  );
}
