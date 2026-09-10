import { describe, expect, it } from "vitest";

import { buildAnnotationLayers } from "../annotation-layers";
import type { ThemeTokens } from "@/lib/api/theme";
import type { VisualizationSpec } from "../spec";

interface Layer {
  mark: { type: string; color?: string; fontWeight?: string };
  encoding: Record<string, { field?: string; type?: string; aggregate?: string; value?: unknown } | undefined>;
  transform?: { filter: string }[];
  data?: { values: unknown[] };
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
  background: "#fff",
  foreground: "#222222",
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

const rows = [
  { region: "North", revenue: 100 },
  { region: "South", revenue: 200 },
];

describe("buildAnnotationLayers", () => {
  it("returns no layers when there are no annotations", () => {
    expect(buildAnnotationLayers(baseSpec(), rows, theme)).toEqual([]);
  });

  it("compiles a reference_line into a rule layer with the correct field/value", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "reference_line", text: "", target_field: "revenue", target_value: 150 }],
    });
    const layers = buildAnnotationLayers(spec, rows, theme) as unknown as Layer[];
    expect(layers).toHaveLength(1);
    expect(layers[0].mark.type).toBe("rule");
    expect(layers[0].encoding.y?.field).toBe("value");
    expect(layers[0].data?.values).toEqual([{ value: 150 }]);
  });

  it("adds a text label layer for a reference_line that has text", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "reference_line", text: "Target", target_field: "revenue", target_value: 150 }],
    });
    const layers = buildAnnotationLayers(spec, rows, theme) as unknown as Layer[];
    expect(layers).toHaveLength(2);
    expect(layers[1].mark.type).toBe("text");
  });

  it("compiles a point (callout) annotation as a marker anchored to the real matching row, not a stored second coordinate", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "callout", text: "Peak", target_field: "region", target_value: "South" }],
    });
    const layers = buildAnnotationLayers(spec, rows, theme) as unknown as Layer[];
    expect(layers).toHaveLength(2); // marker + text
    expect(layers[0].mark.type).toBe("point");
    expect(layers[0].transform?.[0].filter).toContain("region");
    expect(layers[0].data?.values).toEqual(rows); // uses the real dataset, not a synthetic point
    expect(layers[0].encoding.y?.field).toBe("revenue");
    expect(layers[0].encoding.y?.aggregate).toBe("sum"); // reuses the chart's own aggregation
    expect(layers[1].mark.type).toBe("text");
    expect(layers[1].encoding.text?.value).toBe("Peak");
  });

  it("compiles a label annotation as text only, no point marker", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "label", text: "Note", target_field: "region", target_value: "North" }],
    });
    const layers = buildAnnotationLayers(spec, rows, theme) as unknown as Layer[];
    expect(layers).toHaveLength(1);
    expect(layers[0].mark.type).toBe("text");
  });

  it("skips a label annotation with no text (nothing to show)", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "label", text: "", target_field: "region", target_value: "North" }],
    });
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("never compiles highlighted_region to a layer -- the persisted shape has only one target_value, not a start/end pair", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "highlighted_region", text: "Promo period", target_field: "revenue", target_value: 100 }],
    });
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("never compiles source_note to a layer -- it stays text below the chart", () => {
    const spec = baseSpec({ annotations: [{ id: "a1", type: "source_note", text: "Source: internal" }] });
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("safely skips an annotation whose target field matches no encoded channel", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "reference_line", text: "", target_field: "unmapped_field", target_value: 5 }],
    });
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("safely skips a point annotation on a chart with no y encoding (nothing to derive)", () => {
    const spec = baseSpec({
      chart_type: "histogram",
      encoding: { x: { field: "revenue", type: "quantitative" } },
      annotations: [{ id: "a1", type: "callout", text: "Spike", target_field: "revenue", target_value: 100 }],
    });
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("skips an annotation missing target_field/target_value entirely rather than throwing", () => {
    const spec = baseSpec({ annotations: [{ id: "a1", type: "reference_line", text: "no anchor" }] });
    expect(() => buildAnnotationLayers(spec, rows, theme)).not.toThrow();
    expect(buildAnnotationLayers(spec, rows, theme)).toEqual([]);
  });

  it("does not throw and skips the rest when one annotation is malformed", () => {
    const spec = baseSpec({
      annotations: [
        { id: "bad", type: "reference_line", text: "", target_field: "revenue", target_value: null as unknown as number },
        { id: "good", type: "reference_line", text: "", target_field: "revenue", target_value: 100 },
      ],
    });
    const layers = buildAnnotationLayers(spec, rows, theme);
    expect(layers).toHaveLength(1);
  });

  it("uses the theme's neutral foreground color, never the negative/status color or a categorical series color", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "reference_line", text: "", target_field: "revenue", target_value: 100 }],
    });
    const layers = buildAnnotationLayers(spec, rows, theme) as unknown as Layer[];
    expect(layers[0].mark.color).toBe(theme.foreground);
  });

  it("falls back to a fixed neutral color when no theme is supplied", () => {
    const spec = baseSpec({
      annotations: [{ id: "a1", type: "reference_line", text: "", target_field: "revenue", target_value: 100 }],
    });
    const layers = buildAnnotationLayers(spec, rows, undefined) as unknown as Layer[];
    expect(layers[0].mark.color).toBeTruthy();
  });

  it("scales to 10 annotations without special-case handling", () => {
    const annotations = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`,
      type: "reference_line" as const,
      text: "",
      target_field: "revenue",
      target_value: i * 10,
    }));
    const spec = baseSpec({ annotations });
    expect(buildAnnotationLayers(spec, rows, theme)).toHaveLength(10);
  });
});
