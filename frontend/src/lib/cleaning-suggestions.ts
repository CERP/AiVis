import type { ColumnProfile } from "@/lib/api/insights";

/** Deterministic client-side heuristics for which cleaning op might help a column -- not
 * AI-generated. Column-name hints mirror the backend profiler's own heuristics
 * (app/insights/profiler.py::_looks_like_currency) rather than semantic_type, because a
 * messy text-stored number/date is classified "text"/"categorical" by the profiler (it only
 * assigns "numeric"/"currency"/"date" to columns that are *already* the right dtype) -- so
 * semantic_type alone can't tell us a column needs coercion; the name plus raw_type can. */

export interface CleaningSuggestion {
  columnName: string;
  operationType: "coerce_numeric" | "parse_dates" | "trim_strings";
  label: string;
  reason: string;
}

const STRING_RAW_TYPES = new Set(["Utf8", "String"]);
const CURRENCY_NAME_HINTS = ["price", "revenue", "cost", "amount", "salary", "total"];
const DATE_NAME_HINTS = ["date", "time", "created", "updated", "day", "month", "year"];

export function computeCleaningSuggestions(columns: ColumnProfile[]): CleaningSuggestion[] {
  const suggestions: CleaningSuggestion[] = [];

  for (const col of columns) {
    if (!STRING_RAW_TYPES.has(col.raw_type)) continue;
    if (col.semantic_type === "identifier" || col.semantic_type === "geographic") continue;

    const lowerName = col.name.toLowerCase();

    if (CURRENCY_NAME_HINTS.some((hint) => lowerName.includes(hint))) {
      suggestions.push({
        columnName: col.name,
        operationType: "coerce_numeric",
        label: `Convert "${col.name}" to numbers`,
        reason: "Column name suggests numeric/currency values stored as text.",
      });
    } else if (DATE_NAME_HINTS.some((hint) => lowerName.includes(hint))) {
      suggestions.push({
        columnName: col.name,
        operationType: "parse_dates",
        label: `Parse "${col.name}" as dates`,
        reason: "Column name suggests dates stored as text.",
      });
    }
  }

  return suggestions;
}
