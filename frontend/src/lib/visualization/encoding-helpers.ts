import type { ColumnProfile } from "@/lib/api/insights";
import type { EncodingType } from "@/lib/visualization/spec";

/** Maps a profiler semantic_type to the Vega-Lite-ish encoding type a change_field command
 * needs. Mirrors the backend's own semantic-type vocabulary (app/insights/profiler.py). */
export function encodingTypeForColumn(column: ColumnProfile): EncodingType {
  switch (column.semantic_type) {
    case "date":
      return "temporal";
    case "numeric":
    case "currency":
      return "quantitative";
    case "categorical":
    case "geographic":
    case "identifier":
    case "boolean":
    case "text":
    default:
      return "nominal";
  }
}
