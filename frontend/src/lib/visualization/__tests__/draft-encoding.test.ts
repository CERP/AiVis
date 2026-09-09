import { describe, expect, it } from "vitest";

import { buildDraftEncoding } from "../draft-encoding";
import { getChartDefinition } from "../registry";
import type { ColumnProfile } from "@/lib/api/insights";

function column(name: string, semantic_type: string): ColumnProfile {
  return {
    id: name,
    name,
    ordinal: 0,
    raw_type: "string",
    semantic_type,
    is_pii: false,
    null_count: 0,
    unique_count: 5,
    stats: {},
  };
}

describe("buildDraftEncoding", () => {
  it("maps a categorical + numeric column onto a bar chart's required x/y", () => {
    const columns = [column("region", "categorical"), column("revenue", "numeric")];
    const encoding = buildDraftEncoding(getChartDefinition("bar")!, columns);

    expect(encoding).not.toBeNull();
    expect(encoding!.x?.field).toBe("region");
    expect(encoding!.x?.type).toBe("nominal");
    expect(encoding!.y?.field).toBe("revenue");
    expect(encoding!.y?.type).toBe("quantitative");
  });

  it("prefers a date column for x when the chart requires temporal data", () => {
    const columns = [column("signup_date", "date"), column("region", "categorical"), column("revenue", "numeric")];
    const encoding = buildDraftEncoding(getChartDefinition("line")!, columns);

    expect(encoding!.x?.field).toBe("signup_date");
    expect(encoding!.x?.type).toBe("temporal");
  });

  it("never assigns the same column to two channels", () => {
    const columns = [column("region", "categorical"), column("revenue", "numeric")];
    const encoding = buildDraftEncoding(getChartDefinition("stacked_bar")!, columns);
    // stacked_bar requires x, y, color -- only 2 columns available, so color can't get a
    // distinct third column and the chart should be reported incompatible.
    expect(encoding).toBeNull();
  });

  it("returns null when the dataset can't satisfy every required channel", () => {
    const columns = [column("only_col", "numeric")];
    const encoding = buildDraftEncoding(getChartDefinition("bar")!, columns);
    expect(encoding).toBeNull();
  });

  it("assigns all four OHLC channels to distinct numeric columns for candlestick", () => {
    const columns = [
      column("day", "date"),
      column("open", "numeric"),
      column("high", "numeric"),
      column("low", "numeric"),
      column("close", "numeric"),
    ];
    const encoding = buildDraftEncoding(getChartDefinition("candlestick")!, columns);

    expect(encoding).not.toBeNull();
    const fields = [encoding!.open?.field, encoding!.high?.field, encoding!.low?.field, encoding!.close?.field];
    expect(new Set(fields).size).toBe(4);
  });
});
