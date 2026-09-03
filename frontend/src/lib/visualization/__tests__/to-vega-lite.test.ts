import { describe, expect, it } from "vitest";

import { compileToVegaLite, textAnnotations } from "@/lib/visualization/to-vega-lite";
import type { ThemeTokens } from "@/lib/api/theme";
import type { VisualizationSpec } from "@/lib/visualization/spec";

/** The compiled Vega-Lite output as this test suite needs to inspect it -- a loose shape
 * (not the real TopLevelSpec union, which is awkward to narrow in tests) covering both the
 * single-layer and multi-layer (annotation) cases. */
interface CompiledSpec {
  mark: { type?: string; innerRadius?: number; color?: string };
  encoding: Record<
    string,
    { field?: string; type?: string; aggregate?: string; sort?: string; axis?: unknown } | undefined
  >;
  transform?: Record<string, unknown>[];
  layer?: {
    mark: { type: string };
    encoding: Record<string, { field?: string; type?: string }>;
  }[];
}

function baseSpec(overrides: Partial<VisualizationSpec> = {}): VisualizationSpec {
  return {
    chart_type: "bar",
    encoding: {
      x: { field: "region", type: "nominal" },
      y: { field: "revenue", type: "quantitative", aggregation: "sum" },
    },
    transformations: [],
    filters: [],
    annotations: [],
    theme: "minimal",
    typography: {},
    layout: { show_legend: true, show_grid: true },
    metadata: { dataset_id: "d1", dataset_version_id: "v1" },
    ...overrides,
  };
}

const theme: ThemeTokens = {
  name: "minimal",
  description: "",
  palette_type: "categorical",
  background: "#ffffff",
  foreground: "#000000",
  grid: "#eee",
  border: "#ccc",
  categorical_colors: ["#E69F00", "#56B4E9"],
  sequential_range: ["#fff", "#000"],
  diverging_range: ["#f00", "#fff", "#00f"],
  positive_color: "#0a0",
  negative_color: "#a00",
  headline_font: "serif",
  body_font: "sans-serif",
};

describe("compileToVegaLite", () => {
  it("maps encoding channels and aggregation", () => {
    const result = compileToVegaLite(baseSpec(), [{ region: "North", revenue: 100 }]) as unknown as CompiledSpec;
    expect(result.encoding.x).toEqual({ field: "region", type: "nominal" });
    expect(result.encoding.y).toMatchObject({ field: "revenue", type: "quantitative", aggregate: "sum" });
  });

  it("applies theme's first categorical color as mark color when there's no color encoding", () => {
    const result = compileToVegaLite(baseSpec(), [], theme) as unknown as CompiledSpec;
    expect(result.mark.color).toBe("#E69F00");
  });

  it("does not override mark color when a color encoding is present", () => {
    const spec = baseSpec({
      encoding: {
        x: { field: "region", type: "nominal" },
        y: { field: "revenue", type: "quantitative" },
        color: { field: "product", type: "nominal" },
      },
    });
    const result = compileToVegaLite(spec, [], theme) as unknown as CompiledSpec;
    expect(result.mark.color).toBeUndefined();
  });

  it("routes size/color to theta/color for donut charts instead of x/y", () => {
    const spec = baseSpec({
      chart_type: "donut",
      encoding: {
        size: { field: "revenue", type: "quantitative" },
        color: { field: "region", type: "nominal" },
      },
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.theta).toMatchObject({ field: "revenue" });
    expect(result.encoding.x).toBeUndefined();
  });

  it("adds a reference-line layer only when the target field matches x or y", () => {
    const spec = baseSpec({
      annotations: [
        {
          id: "a1",
          type: "reference_line",
          text: "Peak",
          target_field: "revenue",
          target_value: 500,
        },
      ],
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.layer).toHaveLength(2);
    expect(result.layer?.[1].mark.type).toBe("rule");
    expect(result.layer?.[1].encoding.y.field).toBe("value");
  });

  it("skips a reference-line annotation whose target field doesn't match any encoded channel", () => {
    const spec = baseSpec({
      annotations: [
        { id: "a1", type: "reference_line", text: "Peak", target_field: "unmapped", target_value: 5 },
      ],
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.layer).toBeUndefined();
  });

  it("does not layer when there are no annotations", () => {
    const result = compileToVegaLite(baseSpec(), []) as unknown as CompiledSpec;
    expect(result.layer).toBeUndefined();
    expect(result.mark).toBeDefined();
  });
});

describe("new chart type compilation", () => {
  it("swaps x/y for horizontal_bar -- a genuine orientation transform, not an approximation", () => {
    const spec = baseSpec({ chart_type: "horizontal_bar" });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.x).toMatchObject({ field: "revenue" });
    expect(result.encoding.y).toMatchObject({ field: "region" });
  });

  it("swaps x/y for stacked_bar_horizontal and keeps the color/stack encoding", () => {
    const spec = baseSpec({
      chart_type: "stacked_bar_horizontal",
      encoding: {
        x: { field: "region", type: "nominal" },
        y: { field: "revenue", type: "quantitative", aggregation: "sum" },
        color: { field: "product", type: "nominal" },
      },
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.x).toMatchObject({ field: "revenue" });
    expect(result.encoding.y).toMatchObject({ field: "region" });
    expect(result.encoding.color).toMatchObject({ field: "product" });
  });

  it("applies descending sort on the categorical axis for sorted_bar by default", () => {
    const spec = baseSpec({ chart_type: "sorted_bar" });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.x?.sort).toBe("-y");
  });

  it("applies ascending sort for sorted_bar when spec.sort.descending is false", () => {
    const spec = baseSpec({ chart_type: "sorted_bar", sort: { field: "revenue", descending: false } });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.x?.sort).toBe("y");
  });

  it("computes a mathematically correct running-cumulative-total transform for waterfall", () => {
    const spec = baseSpec({ chart_type: "waterfall" });
    const result = compileToVegaLite(spec, [
      { region: "Start", revenue: 100 },
      { region: "Q1", revenue: 50 },
      { region: "Q2", revenue: -20 },
    ]) as unknown as CompiledSpec;
    // y = cumulative total *before* this row, y2 = cumulative total *after* -- so each bar
    // spans exactly the right range regardless of row order, computed by Vega-Lite's own
    // window transform (not a client-side precomputed approximation).
    expect(result.transform).toBeDefined();
    expect(result.transform?.[0]).toMatchObject({
      window: [{ op: "sum", field: "revenue", as: "cumulative" }],
    });
    expect(result.encoding.y).toMatchObject({ field: "start", type: "quantitative" });
    expect(result.encoding.y2).toMatchObject({ field: "cumulative" });
  });

  it("uses innerRadius 0 for pie and 60 for donut -- same arc mark, different geometry", () => {
    const pieSpec = baseSpec({
      chart_type: "pie",
      encoding: {
        size: { field: "revenue", type: "quantitative" },
        color: { field: "region", type: "nominal" },
      },
    });
    const donutSpec = { ...pieSpec, chart_type: "donut" };
    const pieResult = compileToVegaLite(pieSpec, []) as unknown as CompiledSpec;
    const donutResult = compileToVegaLite(donutSpec, []) as unknown as CompiledSpec;
    expect(pieResult.mark.innerRadius).toBe(0);
    expect(donutResult.mark.innerRadius).toBe(60);
  });

  it("compiles heatmap with x/y/color as rect mark, color forced quantitative", () => {
    const spec = baseSpec({
      chart_type: "heatmap",
      encoding: {
        x: { field: "region", type: "nominal" },
        y: { field: "product", type: "nominal" },
        color: { field: "revenue", type: "quantitative" },
      },
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.mark.type).toBe("rect");
    expect(result.encoding.color).toMatchObject({ field: "revenue", type: "quantitative" });
  });

  it("compiles bubble with size encoding present (area-proportional by Vega-Lite default)", () => {
    const spec = baseSpec({
      chart_type: "bubble",
      encoding: {
        x: { field: "revenue", type: "quantitative" },
        y: { field: "units", type: "quantitative" },
        size: { field: "profit", type: "quantitative" },
      },
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.mark.type).toBe("point");
    expect(result.encoding.size).toMatchObject({ field: "profit" });
  });

  it("hides axes for sparkline (compact inline trend, no chrome)", () => {
    const spec = baseSpec({
      chart_type: "sparkline",
      encoding: {
        x: { field: "region", type: "temporal" },
        y: { field: "revenue", type: "quantitative" },
      },
    });
    const result = compileToVegaLite(spec, []) as unknown as CompiledSpec;
    expect(result.encoding.x?.axis).toBeNull();
    expect(result.encoding.y?.axis).toBeNull();
  });
});

describe("textAnnotations", () => {
  it("excludes reference_line annotations", () => {
    const spec = baseSpec({
      annotations: [
        { id: "a1", type: "reference_line", text: "Peak", target_field: "revenue", target_value: 5 },
        { id: "a2", type: "source_note", text: "Source: internal" },
      ],
    });
    const result = textAnnotations(spec);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
  });
});
