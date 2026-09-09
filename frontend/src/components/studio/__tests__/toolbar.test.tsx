import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StudioToolbar } from "../toolbar";
import type { VisualizationVersion } from "@/lib/api/visualizations";

function version(overrides: Partial<VisualizationVersion> = {}): VisualizationVersion {
  return {
    id: "ver1",
    visualization_id: "viz1",
    version_number: 1,
    spec: {} as VisualizationVersion["spec"],
    change_summary: null,
    created_by: "user",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("StudioToolbar", () => {
  it("shows the Back to Analysis link with the given href", () => {
    render(
      <StudioToolbar
        backHref="/projects/p1/datasets/d1/analysis"
        breadcrumbItems={[{ label: "Acme" }, { label: "sales.csv" }, { label: "Revenue" }]}
        versionLabel="v1 · saved just now"
        versions={[version()]}
        canUndo={false}
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: /Back to Analysis/ })).toHaveAttribute(
      "href",
      "/projects/p1/datasets/d1/analysis"
    );
  });

  it("renders the breadcrumb context", () => {
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Acme" }, { label: "sales.csv" }, { label: "Revenue" }]}
        versionLabel="v1 · saved just now"
        versions={[]}
        canUndo={false}
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={vi.fn()}
      />
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("shows the real version label", () => {
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Revenue" }]}
        versionLabel="v4 · saved 2m ago"
        versions={[]}
        canUndo={false}
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={vi.fn()}
      />
    );
    expect(screen.getByText("v4 · saved 2m ago")).toBeInTheDocument();
  });

  it("disables Undo when canUndo is false", () => {
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Revenue" }]}
        versionLabel="v1"
        versions={[]}
        canUndo={false}
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("calls onUndo when Undo is clicked and enabled", async () => {
    const onUndo = vi.fn();
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Revenue" }]}
        versionLabel="v2"
        versions={[]}
        canUndo
        isUndoing={false}
        onUndo={onUndo}
        onExportClick={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("calls onExportClick when Export is clicked", async () => {
    const onExportClick = vi.fn();
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Revenue" }]}
        versionLabel="v1"
        versions={[]}
        canUndo={false}
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={onExportClick}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(onExportClick).toHaveBeenCalledOnce();
  });

  it("opens a version history dropdown showing real version numbers, not fabricated ones", async () => {
    render(
      <StudioToolbar
        backHref="/x"
        breadcrumbItems={[{ label: "Revenue" }]}
        versionLabel="v3 · saved 1m ago"
        versions={[version({ id: "v1", version_number: 1 }), version({ id: "v2", version_number: 2 }), version({ id: "v3", version_number: 3 })]}
        canUndo
        isUndoing={false}
        onUndo={vi.fn()}
        onExportClick={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText("v3 · saved 1m ago"));
    const list = screen.getByRole("list", { name: "Version history" });
    expect(list.textContent).toMatch(/v3/);
    expect(list.textContent).toMatch(/v2/);
    expect(list.textContent).toMatch(/v1/);
  });
});
