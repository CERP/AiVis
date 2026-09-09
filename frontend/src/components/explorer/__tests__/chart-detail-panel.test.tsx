import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartDetailPanel } from "../chart-detail-panel";
import { getChartDefinition } from "@/lib/visualization/registry";

describe("ChartDetailPanel", () => {
  it("shows the chart name, best-for description, and compatibility requirements", () => {
    const def = getChartDefinition("candlestick")!;
    render(<ChartDetailPanel def={def} onUse={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: def.label })).toBeInTheDocument();
    expect(screen.getByText(def.description)).toBeInTheDocument();
    expect(screen.getByText(/Open, High, Low, Close/)).toBeInTheDocument();
  });

  it("calls onUse when 'Use this chart' is clicked", async () => {
    const onUse = vi.fn();
    const def = getChartDefinition("bar")!;
    render(<ChartDetailPanel def={def} onUse={onUse} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Use this chart" }));
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("calls onClose on the close button", async () => {
    const onClose = vi.fn();
    const def = getChartDefinition("bar")!;
    render(<ChartDetailPanel def={def} onUse={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close chart details" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const def = getChartDefinition("bar")!;
    render(<ChartDetailPanel def={def} onUse={vi.fn()} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables the Use action while creating", () => {
    const def = getChartDefinition("bar")!;
    render(<ChartDetailPanel def={def} onUse={vi.fn()} onClose={vi.fn()} isCreating />);
    expect(screen.getByRole("button", { name: "Opening…" })).toBeDisabled();
  });
});
