import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MappingTab } from "../mapping-tab";
import type { ColumnProfile } from "@/lib/api/insights";

function col(name: string, semantic_type: string): ColumnProfile {
  return { id: name, name, ordinal: 0, raw_type: "string", semantic_type, is_pii: false, null_count: 0, unique_count: 5, stats: {} };
}

const columns = [col("region", "categorical"), col("revenue", "numeric"), col("date", "date")];

describe("MappingTab", () => {
  it("shows X-Axis and Y-Axis for a bar chart", () => {
    render(<MappingTab chartType="bar" encoding={{}} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(screen.getByText("X-Axis")).toBeInTheDocument();
    expect(screen.getByText("Y-Axis")).toBeInTheDocument();
    expect(screen.queryByText("Size")).not.toBeInTheDocument();
  });

  it("shows X, Y, Color, and Size for a scatter/bubble-capable chart", () => {
    render(<MappingTab chartType="bubble" encoding={{}} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(screen.getByText("X-Axis")).toBeInTheDocument();
    expect(screen.getByText("Y-Axis")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
  });

  it("relabels Source/Target/Measure for sankey instead of generic X/Y/Size", () => {
    render(<MappingTab chartType="sankey" encoding={{}} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("Measure")).toBeInTheDocument();
    expect(screen.queryByText("X-Axis")).not.toBeInTheDocument();
  });

  it("relabels Value for KPI instead of generic Size", () => {
    render(<MappingTab chartType="kpi" encoding={{}} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.queryByText("Size")).not.toBeInTheDocument();
  });

  it("for candlestick, shows only Date as editable and lists OHLC as automatically-set, not fake dropdowns", () => {
    render(<MappingTab chartType="candlestick" encoding={{}} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1); // only the Date field selector
    expect(screen.getByText(/Also uses: Open, High, Low, Close/)).toBeInTheDocument();
    expect(screen.getByText(/not yet manually editable/)).toBeInTheDocument();
  });

  it("calls onChangeField with the channel, field, and encoding type", async () => {
    const onChangeField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<MappingTab chartType="bar" encoding={{}} columns={columns} onChangeField={onChangeField} onChangeAggregation={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("X-Axis"), "region");
    expect(onChangeField).toHaveBeenCalledWith("x", "region", "nominal");
  });

  it("does not delete a saved encoding on a channel the current chart type no longer surfaces as editable -- it's presentation-only filtering", () => {
    // A saved spec with a color mapping, viewed under a chart type (histogram) that doesn't
    // list color as required/optional: histogram's own inspector simply won't show a Color
    // control, but the encoding object passed in is never mutated by this component.
    const encoding = { x: { field: "revenue", type: "quantitative" as const }, color: { field: "region", type: "nominal" as const } };
    render(<MappingTab chartType="histogram" encoding={encoding} columns={columns} onChangeField={vi.fn()} onChangeAggregation={vi.fn()} />);
    expect(encoding.color).toEqual({ field: "region", type: "nominal" });
  });
});
