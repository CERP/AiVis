import type { WorkflowCleaningStep } from "@/lib/api/datasets";

/** Plain-English labels derived only from `action_type`/`params` -- the backend's closed,
 * documented set of supported actions (see SUPPORTED_ACTIONS in validation_workflow.py).
 * Translating a known vocabulary into product language isn't fabrication; inventing a rationale
 * the backend didn't provide would be, which is why "why this change" always comes from the
 * step's own `reason` field instead (Gemini's actual explanation), never from this function. */
export function operationTitle(step: WorkflowCleaningStep): string {
  const col = step.column_name;
  switch (step.action_type) {
    case "trim_strings":
      return col ? `Trim whitespace in ${col}` : "Trim whitespace";
    case "standardize_case":
      return col ? `Normalize casing in ${col}` : "Normalize casing";
    case "coerce_numeric":
      return col ? `Convert ${col} to numbers` : "Convert to numbers";
    case "parse_dates":
      return col ? `Parse ${col} as dates` : "Parse as dates";
    case "normalize_percentage":
      return col ? `Normalize percentages in ${col}` : "Normalize percentages";
    case "dedupe_rows":
      return "Remove duplicate rows";
    case "replace_values":
      return col ? `Normalize values in ${col}` : "Normalize values";
    case "normalize_boolean":
      return col ? `Normalize ${col} to true/false` : "Normalize to true/false";
    case "fill_missing": {
      const method = step.params?.method;
      if (method === "mean") return col ? `Fill missing ${col} with the average` : "Fill missing values with the average";
      if (method === "median") return col ? `Fill missing ${col} with the median` : "Fill missing values with the median";
      if (method === "mode") return col ? `Fill missing ${col} with the most common value` : "Fill missing values with the most common value";
      return col ? `Fill missing values in ${col}` : "Fill missing values";
    }
    default:
      return col ? `${step.action_type.replaceAll("_", " ")} on ${col}` : step.action_type.replaceAll("_", " ");
  }
}

export function operationMethod(step: WorkflowCleaningStep): string {
  switch (step.action_type) {
    case "trim_strings":
      return "Removed leading and trailing whitespace";
    case "standardize_case":
      return `Standardized casing to ${String(step.params?.case ?? "a consistent form")}`;
    case "coerce_numeric":
      return "Converted text values to numbers";
    case "parse_dates":
      return "Parsed text values as dates";
    case "normalize_percentage":
      return "Converted values to a consistent percentage scale";
    case "dedupe_rows":
      return "Removed exact full-row duplicates";
    case "replace_values":
      return "Mapped specific values to a standard form";
    case "normalize_boolean":
      return "Mapped values to true/false";
    case "fill_missing": {
      const method = step.params?.method;
      if (method === "constant") return `Filled with a fixed value (${String(step.params?.value)})`;
      if (method === "mean") return "Filled using the column average";
      if (method === "median") return "Filled using the column median (stable against outliers)";
      if (method === "mode") return "Filled using the most frequent value";
      return "Filled using an imputed value";
    }
    default:
      return step.action_type.replaceAll("_", " ");
  }
}
