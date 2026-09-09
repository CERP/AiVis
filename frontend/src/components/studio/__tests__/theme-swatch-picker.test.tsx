import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeSwatchPicker } from "../theme-swatch-picker";
import type { ThemeTokens } from "@/lib/api/theme";

function theme(name: string): ThemeTokens {
  return {
    name,
    description: "d",
    palette_type: "categorical",
    background: "#fff",
    foreground: "#000",
    grid: "#ccc",
    border: "#ddd",
    categorical_colors: ["#111", "#222", "#333", "#444"],
    sequential_range: ["#fff", "#000"],
    diverging_range: ["#a00", "#fff", "#00a"],
    positive_color: "#0a0",
    negative_color: "#a00",
    headline_font: "sans",
    body_font: "sans",
  };
}

describe("ThemeSwatchPicker", () => {
  it("renders one swatch per theme", () => {
    render(
      <ThemeSwatchPicker themes={[theme("executive_neutral"), theme("dark_data")]} onSelect={vi.fn()} onHoverChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /executive neutral/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dark data/ })).toBeInTheDocument();
  });

  it("marks the selected theme", () => {
    const t = theme("executive_neutral");
    render(<ThemeSwatchPicker themes={[t]} selected={t} onSelect={vi.fn()} onHoverChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /executive neutral/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    const t = theme("executive_neutral");
    render(<ThemeSwatchPicker themes={[t]} onSelect={onSelect} onHoverChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /executive neutral/ }));
    expect(onSelect).toHaveBeenCalledWith(t);
  });

  it("calls onHoverChange on mouse enter/leave for a live preview without committing", async () => {
    const onHoverChange = vi.fn();
    const t = theme("executive_neutral");
    render(<ThemeSwatchPicker themes={[t]} onSelect={vi.fn()} onHoverChange={onHoverChange} />);
    await userEvent.hover(screen.getByRole("button", { name: /executive neutral/ }));
    expect(onHoverChange).toHaveBeenCalledWith(t);
    await userEvent.unhover(screen.getByRole("button", { name: /executive neutral/ }));
    expect(onHoverChange).toHaveBeenCalledWith(undefined);
  });
});
