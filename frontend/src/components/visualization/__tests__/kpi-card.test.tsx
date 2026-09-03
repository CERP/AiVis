import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KPICard } from "@/components/visualization/kpi-card";
import type { VisualizationSpec } from "@/lib/visualization/spec";

function spec(overrides: Partial<VisualizationSpec["encoding"]> = {}): VisualizationSpec {
  return {
    chart_type: "kpi",
    encoding: { size: { field: "revenue", type: "quantitative", aggregation: "sum" }, ...overrides },
    transformations: [],
    filters: [],
    annotations: [],
    theme: "minimal",
    typography: { title: "Total revenue" },
    layout: { show_legend: true, show_grid: true },
    metadata: { dataset_id: "d1", dataset_version_id: "v1" },
  };
}

describe("KPICard", () => {
  it("sums the measure field by default, from real row data", () => {
    render(<KPICard spec={spec()} rows={[{ revenue: 100 }, { revenue: 250 }, { revenue: 50 }]} />);
    expect(screen.getByText("400")).toBeInTheDocument();
  });

  it("computes mean when the encoding requests it", () => {
    const s = spec();
    s.encoding.size = { field: "revenue", type: "quantitative", aggregation: "mean" };
    render(<KPICard spec={s} rows={[{ revenue: 100 }, { revenue: 200 }]} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("computes a real period-over-period change when a temporal field is present", () => {
    const s = spec({ x: { field: "date", type: "temporal" } });
    render(
      <KPICard
        spec={s}
        rows={[
          { date: "2026-01-01", revenue: 100 },
          { date: "2026-01-02", revenue: 150 },
        ]}
      />
    );
    // sum(100+150)=250 is the displayed KPI value; first=100, last=150 -> +50%
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
  });

  it("shows no comparison when there is no temporal field -- never fabricates one", () => {
    render(<KPICard spec={spec()} rows={[{ revenue: 100 }]} />);
    expect(screen.queryByText(/vs first period/)).not.toBeInTheDocument();
  });

  it("shows an error state when no measure field is configured", () => {
    const s = spec();
    s.encoding.size = undefined;
    render(<KPICard spec={s} rows={[]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/requires a measure field/);
  });
});
