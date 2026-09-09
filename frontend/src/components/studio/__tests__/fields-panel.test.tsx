import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FieldsPanel } from "../fields-panel";
import type { ColumnProfile } from "@/lib/api/insights";

function col(name: string, semantic_type: string): ColumnProfile {
  return { id: name, name, ordinal: 0, raw_type: "string", semantic_type, is_pii: false, null_count: 0, unique_count: 5, stats: {} };
}

describe("FieldsPanel", () => {
  it("renders every column", () => {
    render(
      <FieldsPanel
        chartType="bar"
        onChangeChartType={vi.fn()}
        columns={[col("region", "categorical"), col("revenue", "numeric")]}
        currentEncoding={{}}
      />
    );
    expect(screen.getByText("region")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
  });

  it("shows the chart type selector with the current chart type selected", () => {
    render(
      <FieldsPanel chartType="scatter" onChangeChartType={vi.fn()} columns={[]} currentEncoding={{}} />
    );
    expect(screen.getByLabelText("Chart type")).toHaveValue("scatter");
  });

  it("calls onChangeChartType when a new type is chosen", async () => {
    const onChangeChartType = vi.fn();
    render(
      <FieldsPanel chartType="bar" onChangeChartType={onChangeChartType} columns={[]} currentEncoding={{}} />
    );
    await userEvent.selectOptions(screen.getByLabelText("Chart type"), "line");
    expect(onChangeChartType).toHaveBeenCalledWith("line");
  });

  it("marks fields that are currently mapped", () => {
    render(
      <FieldsPanel
        chartType="bar"
        onChangeChartType={vi.fn()}
        columns={[col("region", "categorical"), col("revenue", "numeric")]}
        currentEncoding={{ x: { field: "region", type: "nominal" } }}
      />
    );
    expect(screen.getByLabelText("region is currently mapped")).toBeInTheDocument();
    expect(screen.queryByLabelText("revenue is currently mapped")).not.toBeInTheDocument();
  });

  it("shows a search input only when there are many fields, and filters by it", async () => {
    const manyColumns = Array.from({ length: 10 }, (_, i) => col(`field_${i}`, "numeric"));
    render(
      <FieldsPanel chartType="bar" onChangeChartType={vi.fn()} columns={manyColumns} currentEncoding={{}} />
    );
    await userEvent.type(screen.getByLabelText("Search fields"), "field_3");
    expect(screen.getByText("field_3")).toBeInTheDocument();
    expect(screen.queryByText("field_0")).not.toBeInTheDocument();
  });

  it("omits the search input when there are few fields", () => {
    render(
      <FieldsPanel chartType="bar" onChangeChartType={vi.fn()} columns={[col("region", "categorical")]} currentEncoding={{}} />
    );
    expect(screen.queryByLabelText("Search fields")).not.toBeInTheDocument();
  });
});
