/**
 * TypeScript mirror of backend/app/visualization/spec.py::VisualizationSpec.
 * Keep these two in sync by hand until a codegen step exists (no frontend
 * visualization UI existed when the Python side was written, so this mirror
 * is being added now, on first actual frontend use).
 */

export type EncodingType = "quantitative" | "ordinal" | "nominal" | "temporal";

export type Aggregation = "none" | "sum" | "mean" | "median" | "count" | "min" | "max";

export interface Encoding {
  field: string;
  type: EncodingType;
  aggregation?: Aggregation;
  label?: string | null;
  format?: string | null;
}

export interface Encodings {
  x?: Encoding | null;
  y?: Encoding | null;
  color?: Encoding | null;
  size?: Encoding | null;
  detail?: Encoding | null;

  /** End of an x-range. Required by Gantt (task start -> end); the bar spans x..x2. */
  x2?: Encoding | null;
  /** End of a y-range. Set automatically by the waterfall compiler. */
  y2?: Encoding | null;

  /** A second, independently-scaled measure -- line_column renders `y` as columns and this
   * as an overlaid line on its own axis. */
  measure2?: Encoding | null;

  /** Open/high/low/close for candlestick and OHLC charts; all four required together. */
  open?: Encoding | null;
  high?: Encoding | null;
  low?: Encoding | null;
  close?: Encoding | null;
}

export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_null";

export interface VizFilter {
  field: string;
  operator: FilterOperator;
  value?: string | number | string[] | number[] | null;
}

export interface SortSpec {
  field: string;
  descending: boolean;
}

export type AnnotationType =
  | "callout"
  | "reference_line"
  | "highlighted_region"
  | "label"
  | "source_note";

export interface Annotation {
  id: string;
  type: AnnotationType;
  text: string;
  target_field?: string | null;
  target_value?: string | number | null;
}

export interface Typography {
  title?: string | null;
  subtitle?: string | null;
  source_note?: string | null;
}

export interface Layout {
  width?: number | null;
  height?: number | null;
  show_legend: boolean;
  show_grid: boolean;
}

export interface VisualizationMetadata {
  dataset_id: string;
  dataset_version_id: string;
  story_id?: string | null;
}

export interface VisualizationSpec {
  chart_type: string;
  encoding: Encodings;
  transformations: string[];
  filters: VizFilter[];
  sort?: SortSpec | null;
  annotations: Annotation[];
  theme: string;
  typography: Typography;
  layout: Layout;
  metadata: VisualizationMetadata;
}
