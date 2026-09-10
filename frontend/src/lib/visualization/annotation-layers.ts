import type { ThemeTokens } from "@/lib/api/theme";
import type { Annotation, VisualizationSpec } from "./spec";

/**
 * Compiles annotations into real Vega-Lite layers, anchored to data values rather than pixels
 * (survives resize/export/theme changes/responsive layout). Every layer is self-contained
 * (carries its own `data`), so it composes safely whether the base chart is a single mark or
 * a multi-layer BuiltSpec from vega-builders.ts.
 *
 * Scope decided from the ACTUAL persisted Annotation shape (id, type, text, target_field,
 * target_value -- one anchor pair, no array/tuple field):
 *   reference_line -- fits perfectly: one axis, one value.
 *   callout / label -- fit as a single-anchor point: target_field pins one axis; the OTHER
 *     axis's value is derived from the real dataset by filtering rows to that anchor and
 *     reusing the chart's own y (or x) encoding/aggregation -- genuinely data-driven, not a
 *     second stored coordinate, and stays in sync with cleaning/data changes automatically.
 *     Requires the chart to have both x and y encoded; skipped otherwise (histogram, pie/donut,
 *     heatmap, etc. don't have a meaningful single point to anchor to from one axis value).
 *   highlighted_region -- genuinely needs TWO values (start and end) and the current schema
 *     has exactly one target_value slot. Deliberately NOT rendered on canvas this batch --
 *     extending the schema was avoided on purpose (see Batch 9 report); it stays in the
 *     accessible text list only.
 *   source_note -- never a plot mark, always text below the chart (unchanged).
 */

const OFFSET_DY = -12;

function axisFor(spec: VisualizationSpec, field: string): "x" | "y" | null {
  if (spec.encoding.x?.field === field) return "x";
  if (spec.encoding.y?.field === field) return "y";
  return null;
}

function otherAxis(axis: "x" | "y"): "x" | "y" {
  return axis === "x" ? "y" : "x";
}

function buildReferenceLineLayers(
  annotation: Annotation,
  spec: VisualizationSpec,
  inkColor: string
): Record<string, unknown>[] {
  if (annotation.target_field == null || annotation.target_value == null) return [];
  const axis = axisFor(spec, annotation.target_field);
  if (!axis) return [];

  const encodingType = spec.encoding[axis]?.type ?? "quantitative";
  const ruleLayer = {
    data: { values: [{ value: annotation.target_value }] },
    mark: { type: "rule", strokeDash: [4, 4], color: inkColor },
    encoding: { [axis]: { field: "value", type: encodingType } },
  };
  if (!annotation.text) return [ruleLayer];

  const textLayer = {
    data: { values: [{ value: annotation.target_value, label: annotation.text }] },
    mark: {
      type: "text",
      align: axis === "x" ? "left" : "right",
      baseline: "bottom",
      dx: axis === "x" ? 4 : 0,
      dy: axis === "x" ? 0 : OFFSET_DY,
      color: inkColor,
    },
    encoding: {
      [axis]: { field: "value", type: encodingType },
      text: { field: "label", type: "nominal" },
    },
  };
  return [ruleLayer, textLayer];
}

/** Shared by callout (point marker + label) and label (text only) -- both anchor to a single
 * data value on one axis and derive the other axis's value from the real rows, since the
 * persisted shape has no second coordinate to store one. */
function buildPointAnchoredLayers(
  annotation: Annotation,
  spec: VisualizationSpec,
  rows: Record<string, unknown>[],
  inkColor: string,
  includeMarker: boolean
): Record<string, unknown>[] {
  if (annotation.target_field == null || annotation.target_value == null) return [];
  if (!spec.encoding.x || !spec.encoding.y) return [];
  const axis = axisFor(spec, annotation.target_field);
  if (!axis) return [];
  const other = otherAxis(axis);

  const axisEncoding = spec.encoding[axis]!;
  const otherEncoding = spec.encoding[other]!;
  const filterValue =
    typeof annotation.target_value === "number"
      ? annotation.target_value
      : JSON.stringify(annotation.target_value);

  const sharedEncoding = {
    [axis]: { field: axisEncoding.field, type: axisEncoding.type },
    [other]: {
      field: otherEncoding.field,
      type: otherEncoding.type,
      ...(otherEncoding.aggregation && otherEncoding.aggregation !== "none"
        ? { aggregate: otherEncoding.aggregation }
        : {}),
    },
  };
  const shared = {
    data: { values: rows },
    transform: [{ filter: `datum.${annotation.target_field} === ${filterValue}` }],
  };

  const layers: Record<string, unknown>[] = [];
  if (includeMarker) {
    layers.push({
      ...shared,
      mark: { type: "point", filled: true, size: 110, color: inkColor },
      encoding: sharedEncoding,
    });
  }
  if (annotation.text) {
    layers.push({
      ...shared,
      mark: { type: "text", dy: OFFSET_DY, color: inkColor, fontWeight: "bold" as const },
      encoding: { ...sharedEncoding, text: { value: annotation.text } },
    });
  }
  return layers;
}

export function buildAnnotationLayers(
  spec: VisualizationSpec,
  rows: Record<string, unknown>[],
  theme?: ThemeTokens
): Record<string, unknown>[] {
  // Neutral annotation ink -- never the UI accent, never a categorical series color, never a
  // status color (the previous default of theme.negative_color was itself a deviation from
  // this rule, fixed as part of this batch). Falls back to a fixed neutral if no theme is
  // supplied at all (e.g. Chart Explorer previews).
  const inkColor = theme?.foreground ?? "#4b4b52";

  const layers: Record<string, unknown>[] = [];
  for (const annotation of spec.annotations) {
    try {
      if (annotation.type === "reference_line") {
        layers.push(...buildReferenceLineLayers(annotation, spec, inkColor));
      } else if (annotation.type === "callout") {
        layers.push(...buildPointAnchoredLayers(annotation, spec, rows, inkColor, true));
      } else if (annotation.type === "label") {
        layers.push(...buildPointAnchoredLayers(annotation, spec, rows, inkColor, false));
      }
      // highlighted_region and source_note are intentionally never compiled to a layer here.
    } catch {
      // A malformed annotation must never break the base chart -- skip it, keep rendering.
      continue;
    }
  }
  return layers;
}
