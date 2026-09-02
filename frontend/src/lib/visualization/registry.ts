/**
 * Chart type registry. Mirrors backend/app/visualization/registry.py's intent (which
 * doesn't exist yet as a separate module -- the recommendation engine, Phase 17, is the
 * next thing that will need a backend-side registry; for now the frontend owns chart-type
 * metadata since it's the only thing consuming it).
 *
 * "renderer" says which engine draws this chart type. Everything starts as "vega-lite" --
 * a generic, spec-driven fallback -- per the architecture's explicit sanction of a
 * Vega-Lite fallback renderer (P16-008). Custom D3 renderers get added incrementally as a
 * chart type's needs outgrow what Vega-Lite can express cleanly (e.g. bespoke annotations,
 * editorial typography control), not before.
 */

export type ChartCategory =
  | "comparison"
  | "temporal"
  | "distribution"
  | "relationship"
  | "part_to_whole"
  | "geographic"
  | "hierarchical"
  | "specialized";

export type RendererEngine = "d3" | "vega-lite";

export interface ChartTypeDefinition {
  id: string;
  label: string;
  category: ChartCategory;
  renderer: RendererEngine;
  requiredEncodings: ("x" | "y" | "color" | "size" | "detail")[];
  implemented: boolean;
}

export const CHART_REGISTRY: ChartTypeDefinition[] = [
  {
    id: "bar",
    label: "Bar chart",
    category: "comparison",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y"],
    implemented: true,
  },
  {
    id: "grouped_bar",
    label: "Grouped bar chart",
    category: "comparison",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y", "color"],
    implemented: true,
  },
  {
    id: "line",
    label: "Line chart",
    category: "temporal",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y"],
    implemented: true,
  },
  {
    id: "area",
    label: "Area chart",
    category: "temporal",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y"],
    implemented: true,
  },
  {
    id: "scatter",
    label: "Scatter plot",
    category: "relationship",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y"],
    implemented: true,
  },
  {
    id: "histogram",
    label: "Histogram",
    category: "distribution",
    renderer: "vega-lite",
    requiredEncodings: ["x"],
    implemented: true,
  },
  {
    id: "box_plot",
    label: "Box plot",
    category: "distribution",
    renderer: "vega-lite",
    requiredEncodings: ["x", "y"],
    implemented: true,
  },
  {
    id: "donut",
    label: "Donut chart",
    category: "part_to_whole",
    renderer: "vega-lite",
    requiredEncodings: ["color", "size"],
    implemented: true,
  },
  // Planned, not yet implemented -- kept here so the recommendation engine (Phase 17) has
  // a stable universe to reference even before a renderer exists for every entry.
  {
    id: "treemap",
    label: "Treemap",
    category: "hierarchical",
    renderer: "d3",
    requiredEncodings: ["size", "color"],
    implemented: false,
  },
  {
    id: "choropleth",
    label: "Choropleth map",
    category: "geographic",
    renderer: "d3",
    requiredEncodings: ["color"],
    implemented: false,
  },
  {
    id: "sankey",
    label: "Sankey diagram",
    category: "specialized",
    renderer: "d3",
    requiredEncodings: ["detail", "size"],
    implemented: false,
  },
];

export function getChartDefinition(chartType: string): ChartTypeDefinition | undefined {
  return CHART_REGISTRY.find((c) => c.id === chartType);
}
