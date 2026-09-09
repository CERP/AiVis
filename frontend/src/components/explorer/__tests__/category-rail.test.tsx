import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryRail } from "../category-rail";
import { categoriesWithCounts } from "@/lib/visualization/chart-taxonomy";

describe("CategoryRail", () => {
  it("renders every category the registry actually has", () => {
    render(<CategoryRail active={null} onChange={vi.fn()} />);
    for (const { label } of categoriesWithCounts()) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the active category", () => {
    render(<CategoryRail active="comparison" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Comparison/ })).toHaveAttribute("aria-current", "true");
  });

  it("calls onChange with the clicked category", async () => {
    const onChange = vi.fn();
    render(<CategoryRail active={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Comparison/ }));
    expect(onChange).toHaveBeenCalledWith("comparison");
  });

  it("toggles off (null) when clicking the already-active category", async () => {
    const onChange = vi.fn();
    render(<CategoryRail active="comparison" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Comparison/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
