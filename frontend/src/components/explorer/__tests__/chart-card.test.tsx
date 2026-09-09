import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/visualization/visualization-renderer", () => ({
  VisualizationRenderer: () => <div data-testid="chart-render">chart</div>,
}));

import { ChartCard } from "../chart-card";
import { getChartDefinition } from "@/lib/visualization/registry";

describe("ChartCard", () => {
  it("renders the chart name, subcategory, and a preview", () => {
    const def = getChartDefinition("bar")!;
    render(<ChartCard def={def} onSelect={vi.fn()} />);
    expect(screen.getByText(def.label)).toBeInTheDocument();
    expect(screen.getByText("magnitude")).toBeInTheDocument();
    expect(screen.getByTestId("chart-render")).toBeInTheDocument();
  });

  it("is a single selectable control (whole card, not a nested button)", async () => {
    const onSelect = vi.fn();
    const def = getChartDefinition("bar")!;
    render(<ChartCard def={def} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(def.label) }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("is keyboard activatable", async () => {
    const onSelect = vi.fn();
    const def = getChartDefinition("bar")!;
    render(<ChartCard def={def} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: new RegExp(def.label) });
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("reflects the selected state", () => {
    const def = getChartDefinition("bar")!;
    render(<ChartCard def={def} selected onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: new RegExp(def.label) })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
