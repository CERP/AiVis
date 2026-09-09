import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/visualization/visualization-renderer", () => ({
  VisualizationRenderer: ({ onReady }: { onReady?: (view: unknown) => void }) => {
    // Mirrors the real component's timing (it calls onReady from an effect after mount, not
    // synchronously during render) -- calling it during render trips React's
    // "Cannot update a component while rendering a different component" warning.
    useEffect(() => {
      onReady?.({});
    }, [onReady]);
    return <div data-testid="chart-render">chart</div>;
  },
}));

vi.mock("@/components/visualization/filter-toolbar", () => ({
  FilterToolbar: () => <div data-testid="filter-toolbar">filters</div>,
}));

vi.mock("@/components/visualization/annotation-list", () => ({
  AnnotationList: () => <div data-testid="annotation-list">annotations</div>,
}));

vi.mock("@/lib/visualization/export", () => ({
  exportSvg: vi.fn().mockResolvedValue(new Blob()),
  exportPng: vi.fn().mockResolvedValue(new Blob()),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "p1", visualizationId: "viz1" }),
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => apiGetMock(...args) },
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

const getDatasetMock = vi.fn();
const getDatasetRowsMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
  getDatasetRows: (...args: unknown[]) => getDatasetRowsMock(...args),
}));

const getProfileMock = vi.fn();
vi.mock("@/lib/api/insights", () => ({
  getProfile: (...args: unknown[]) => getProfileMock(...args),
}));

const getThemeRecommendationsMock = vi.fn();
vi.mock("@/lib/api/theme", () => ({
  getThemeRecommendations: (...args: unknown[]) => getThemeRecommendationsMock(...args),
}));

const getVisualizationMock = vi.fn();
const listVersionsMock = vi.fn();
const applyCommandMock = vi.fn();
const undoVisualizationMock = vi.fn();
vi.mock("@/lib/api/visualizations", () => ({
  getVisualization: (...args: unknown[]) => getVisualizationMock(...args),
  listVersions: (...args: unknown[]) => listVersionsMock(...args),
  applyCommand: (...args: unknown[]) => applyCommandMock(...args),
  undoVisualization: (...args: unknown[]) => undoVisualizationMock(...args),
}));

const createExportMock = vi.fn();
vi.mock("@/lib/api/exports", () => ({
  createExport: (...args: unknown[]) => createExportMock(...args),
}));

import StudioPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StudioPage />
    </QueryClientProvider>
  );
}

function baseSpec(overrides: Record<string, unknown> = {}) {
  return {
    chart_type: "bar",
    encoding: { x: { field: "region", type: "nominal" }, y: { field: "revenue", type: "quantitative" } },
    transformations: [],
    filters: [],
    annotations: [],
    theme: "default",
    typography: {},
    layout: { show_legend: true, show_grid: true },
    metadata: { dataset_id: "d1", dataset_version_id: "v1" },
    ...overrides,
  };
}

const visualization = { id: "viz1", project_id: "p1", dataset_id: "d1", dataset_version_id: "v1", story_id: null, title: "Revenue by region", current_version_id: "ver1", is_favorite: false };
const versions = [
  { id: "ver1", visualization_id: "viz1", version_number: 1, spec: baseSpec(), change_summary: null, created_by: "system", created_at: new Date().toISOString() },
];
const profile = {
  dataset_version_id: "v1",
  row_count: 10,
  column_count: 2,
  columns: [
    { id: "c1", name: "region", ordinal: 0, raw_type: "string", semantic_type: "categorical", is_pii: false, null_count: 0, unique_count: 4, stats: {} },
    { id: "c2", name: "revenue", ordinal: 1, raw_type: "float", semantic_type: "numeric", is_pii: false, null_count: 0, unique_count: 10, stats: {} },
  ],
};
const themes = { top: [{ name: "executive_neutral", description: "d", palette_type: "categorical", background: "#fff", foreground: "#000", grid: "#ccc", border: "#ddd", categorical_colors: ["#111", "#222", "#333", "#444"], sequential_range: ["#fff", "#000"], diverging_range: ["#a00", "#fff", "#00a"], positive_color: "#0a0", negative_color: "#a00", headline_font: "sans", body_font: "sans" }], rest: [] };

describe("StudioPage (nested)", () => {
  beforeEach(() => {
    apiGetMock.mockReset().mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockReset().mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getDatasetRowsMock.mockReset().mockResolvedValue({ dataset_version_id: "v1", total_row_count: 1200, returned_row_count: 500, rows: [{ region: "North", revenue: 10 }] });
    getProfileMock.mockReset().mockResolvedValue(profile);
    getThemeRecommendationsMock.mockReset().mockResolvedValue(themes);
    getVisualizationMock.mockReset().mockResolvedValue(visualization);
    listVersionsMock.mockReset().mockResolvedValue(versions);
    applyCommandMock.mockReset();
    undoVisualizationMock.mockReset();
    createExportMock.mockReset();
  });

  it("renders no global AppShell nav -- Studio is its own dedicated shell", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });

  it("shows the real, non-fabricated row count in the canvas status line", async () => {
    renderPage();
    expect(await screen.findByText(/Preview · 500 of 1200 rows · v1/)).toBeInTheDocument();
  });

  it("Back to Analysis points at the dataset's real Analysis route", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    expect(screen.getByRole("link", { name: /Back to Analysis/ })).toHaveAttribute(
      "href",
      "/projects/p1/datasets/d1/analysis"
    );
  });

  it("Mapping tab filters channels by the current chart type (bar: no Size)", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    expect(screen.getByText("X-Axis")).toBeInTheDocument();
    expect(screen.getByText("Y-Axis")).toBeInTheDocument();
    expect(screen.queryByText("Size")).not.toBeInTheDocument();
  });

  it("regression: changing a field still dispatches the existing change_field command", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    const xAxisSelect = screen.getByLabelText("X-Axis");
    await within(xAxisSelect).findByRole("option", { name: /revenue/ });
    await userEvent.selectOptions(xAxisSelect, "revenue");
    expect(applyCommandMock).toHaveBeenCalledWith("viz1", {
      type: "change_field",
      params: { channel: "x", field: "revenue", encoding_type: "quantitative" },
    });
  });

  it("regression: Undo still calls the existing undo endpoint", async () => {
    listVersionsMock.mockResolvedValue([...versions, { ...versions[0], id: "ver2", version_number: 2 }]);
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undoVisualizationMock).toHaveBeenCalledWith("viz1");
  });

  it("Undo stays disabled with only one version", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("regression: Slicers tab still renders the existing FilterToolbar", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("tab", { name: "Slicers" }));
    expect(screen.getByTestId("filter-toolbar")).toBeInTheDocument();
  });

  it("regression: Notes tab still lists and can add annotations via the existing command", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.type(screen.getByLabelText("New annotation text"), "Peak season");
    await userEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    expect(applyCommandMock).toHaveBeenCalledWith(
      "viz1",
      expect.objectContaining({ type: "add_annotation", params: expect.objectContaining({ text: "Peak season" }) })
    );
  });

  it("regression: Theme tab still applies themes via the existing command", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("tab", { name: "Theme" }));
    await userEvent.click(screen.getByRole("button", { name: /executive neutral/ }));
    expect(applyCommandMock).toHaveBeenCalledWith("viz1", { type: "change_theme", params: { theme: "executive_neutral" } });
  });

  it("regression: Export tab still triggers the existing export + createExport flow", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("tab", { name: "Export" }));
    await userEvent.click(screen.getByRole("button", { name: /High-res SVG/ }));
    await waitFor(() => expect(createExportMock).toHaveBeenCalledWith("ver1", "svg", expect.anything(), "visualization.svg"));
  });

  it("toolbar Export jumps to the Export tab", async () => {
    renderPage();
    await screen.findByText("Revenue by region");
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("button", { name: /High-res SVG/ })).toBeInTheDocument();
  });

  it("shows an error state without crashing when the visualization fails to load", async () => {
    getVisualizationMock.mockRejectedValue(new Error("not found"));
    renderPage();
    expect(await screen.findByText(/Couldn't load this visualization/)).toBeInTheDocument();
  });
});
