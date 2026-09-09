import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
}));

vi.mock("../theme-toggle", () => ({
  ThemeToggle: () => <button aria-label="Switch to dark mode">theme</button>,
}));

vi.mock("../user-menu", () => ({
  UserMenu: () => <button aria-label="Account menu">user</button>,
}));

import { AppShell } from "../app-shell";

describe("AppShell", () => {
  it("renders Projects and Chart Explorer nav links", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: "Chart Explorer" })).toHaveAttribute(
      "href",
      "/explorer"
    );
  });

  it("marks the active nav item with aria-current", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Chart Explorer" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("does not render the retired workspace label", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.queryByText("Analytics workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Gemini assisted")).not.toBeInTheDocument();
  });

  it("still renders theme and user controls", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("renders page content", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
