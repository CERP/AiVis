import { describe, expect, it } from "vitest";

import { compileToVegaLite, textAnnotations } from "@/lib/visualization/to-vega-lite";
import type { ThemeTokens } from "@/lib/api/theme";
import type { VisualizationSpec } from "@/lib/visualization/spec";

/** The compiled Vega-Lite output as this test suite needs to inspect it -- a loose shape
 * (not the real TopLevelSpec union, which is awkward to narrow in tests) covering both the
 * single-layer and multi-layer (annotation) cases. */
interface CompiledSpec {
  mark: { type?: string; color?: string };
  encoding: Record<string, { field?: string; type?: string; aggregate?: string } | undefined>;
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
