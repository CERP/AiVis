import { describe, expect, it } from "vitest";

import { computeCleaningSuggestions } from "@/lib/cleaning-suggestions";
import type { ColumnProfile } from "@/lib/api/insights";

function column(overrides: Partial<ColumnProfile>): ColumnProfile {
  return {
    id: "c1",
    name: "col",
    ordinal: 0,
    raw_type: "Utf8",
    semantic_type: "text",
    is_pii: false,
    null_count: 0,
    unique_count: 5,
    stats: {},
    ...overrides,
  };
}

describe("computeCleaningSuggestions", () => {
  it("suggests coerce_numeric for a text column with a currency-hinted name", () => {
    const suggestions = computeCleaningSuggestions([column({ name: "revenue" })]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].operationType).toBe("coerce_numeric");
    expect(suggestions[0].columnName).toBe("revenue");
  });

  it("suggests parse_dates for a text column with a date-hinted name", () => {
    const suggestions = computeCleaningSuggestions([column({ name: "created_at" })]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].operationType).toBe("parse_dates");
  });

  it("does not suggest anything for a column that is already numeric-typed", () => {
    const suggestions = computeCleaningSuggestions([
      column({ name: "revenue", raw_type: "Float64", semantic_type: "currency" }),
    ]);
    expect(suggestions).toHaveLength(0);
  });

  it("does not suggest anything for a plain text column with no name hints", () => {
    const suggestions = computeCleaningSuggestions([column({ name: "product" })]);
    expect(suggestions).toHaveLength(0);
  });

  it("skips identifier and geographic columns even with matching names", () => {
    const suggestions = computeCleaningSuggestions([
      column({ name: "order_date_id", semantic_type: "identifier" }),
    ]);
    expect(suggestions).toHaveLength(0);
  });

  it("handles multiple columns independently", () => {
    const suggestions = computeCleaningSuggestions([
      column({ name: "revenue" }),
      column({ name: "date" }),
      column({ name: "region" }),
    ]);
    expect(suggestions.map((s) => s.columnName).sort()).toEqual(["date", "revenue"]);
  });
});
