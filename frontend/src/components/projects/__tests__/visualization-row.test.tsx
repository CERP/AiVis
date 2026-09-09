import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisualizationRow } from "../visualization-row";
import type { VisualizationSummary } from "@/lib/api/visualizations";

const visualization: VisualizationSummary = {
  id: "v1",
  title: "Revenue by region",
  chart_type: "bar",
  dataset_id: "d1",
  dataset_name: "sales_q3.csv",
  updated_at: new Date().toISOString(),
};

describe("VisualizationRow", () => {
  it("renders the title and chart type", () => {
    render(<VisualizationRow visualization={visualization} projectId="p1" />);
    expect(screen.getByText("Revenue by region")).toBeInTheDocument();
    expect(screen.getByText(/Bar/)).toBeInTheDocument();
  });

  it("shows the source dataset when available", () => {
    render(<VisualizationRow visualization={visualization} projectId="p1" />);
    expect(screen.getByText(/from sales_q3.csv/)).toBeInTheDocument();
  });

  it("links to the nested studio route for the visualization", () => {
    render(<VisualizationRow visualization={visualization} projectId="p1" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/projects/p1/visualizations/v1"
    );
  });

  it("falls back gracefully when chart_type is missing", () => {
    render(<VisualizationRow visualization={{ ...visualization, chart_type: null }} projectId="p1" />);
    expect(screen.getByText(/Chart ·/)).toBeInTheDocument();
  });
});
