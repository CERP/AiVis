import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/visualization/visualization-renderer", () => ({
  VisualizationRenderer: () => <div data-testid="chart-render">chart</div>,
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "p1", datasetId: "d1" }),
  useRouter: () => ({ push: routerPush }),
}));

const projectGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => projectGetMock(...args) },
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

const getDatasetMock = vi.fn();
const getDatasetFavoritesMock = vi.fn();
const getDatasetRowsMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
  getDatasetFavorites: (...args: unknown[]) => getDatasetFavoritesMock(...args),
  getDatasetRows: (...args: unknown[]) => getDatasetRowsMock(...args),
}));

const getAnalysisMock = vi.fn();
const getAnalysisFindingsMock = vi.fn();
const retryAnalysisMock = vi.fn();
vi.mock("@/lib/api/analysis", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
  getAnalysisFindings: (...args: unknown[]) => getAnalysisFindingsMock(...args),
  retryAnalysis: (...args: unknown[]) => retryAnalysisMock(...args),
  ANALYSIS_STAGE_LABELS: { ai_analyzing: "AI is analyzing" },
}));

const createVisualizationMock = vi.fn();
const setVisualizationFavoriteMock = vi.fn();
vi.mock("@/lib/api/visualizations", () => ({
  createVisualization: (...args: unknown[]) => createVisualizationMock(...args),
  setVisualizationFavorite: (...args: unknown[]) => setVisualizationFavoriteMock(...args),
}));

import AnalysisPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalysisPage />
    </QueryClientProvider>
  );
}

function makeSpec(chartType = "bar") {
  return {
    chart_type: chartType,
    encoding: { x: { field: "region", type: "nominal" }, y: { field: "revenue", type: "quantitative" } },
    transformations: [],
    filters: [],
    annotations: [],
    theme: "default",
    typography: {},
    layout: { show_legend: true, show_grid: true },
    metadata: { dataset_id: "d1", dataset_version_id: "v1" },
  };
}

function makeFinding(id: string, category = "trend") {
  return {
    story_id: id,
    title: `Finding ${id}`,
    description: `Description ${id}`,
    category,
    confidence: 0.9,
    spec: makeSpec(),
  };
}

const readyAnalysis = { status: "ready", stages: {}, dataset_version_id: "v1", data_quality: { score: 90, issues: [] }, error: null };

describe("AnalysisPage", () => {
  beforeEach(() => {
    projectGetMock.mockReset().mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockReset().mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getDatasetFavoritesMock.mockReset().mockResolvedValue([]);
    getDatasetRowsMock.mockReset().mockResolvedValue({ rows: [{ region: "North", revenue: 10 }] });
    getAnalysisMock.mockReset().mockResolvedValue(readyAnalysis);
    getAnalysisFindingsMock.mockReset();
    retryAnalysisMock.mockReset();
    routerPush.mockClear();
  });

  it("renders the breadcrumb and active Analysis stage tab", async () => {
    getAnalysisFindingsMock.mockResolvedValue({ items: [makeFinding("1")], offset: 0, limit: 8, total: 1, next_offset: null, has_more: false });
    renderPage();

    expect(await screen.findByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(screen.getByText("sales_q3.csv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analysis" })).toHaveAttribute("aria-current", "page");
  });

  it("shows up to 8 findings by default", async () => {
    const items = Array.from({ length: 8 }, (_, i) => makeFinding(String(i)));
    getAnalysisFindingsMock.mockResolvedValue({ items, offset: 0, limit: 8, total: 12, next_offset: 8, has_more: true });
    renderPage();

    expect(await screen.findByText("Findings (12)")).toBeInTheDocument();
    for (const item of items) expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore more angles" })).toBeInTheDocument();
  });

  it("shows the honest shortfall message instead of 'Explore more' when fewer strong findings exist", async () => {
    getAnalysisFindingsMock.mockResolvedValue({
      items: [makeFinding("1"), makeFinding("2")],
      offset: 0,
      limit: 8,
      total: 2,
      next_offset: null,
      has_more: false,
    });
    renderPage();

    expect(await screen.findByText("AiVis found 2 strong analytical angles in this dataset.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explore more angles" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Only 2 found/)).not.toBeInTheDocument();
  });

  it("appends the next batch on 'Explore more angles' without losing current items or duplicating", async () => {
    getAnalysisFindingsMock.mockResolvedValueOnce({
      items: [makeFinding("1"), makeFinding("2")],
      offset: 0,
      limit: 8,
      total: 4,
      next_offset: 2,
      has_more: true,
    });
    renderPage();

    expect(await screen.findByText("Finding 1")).toBeInTheDocument();

    getAnalysisFindingsMock.mockResolvedValueOnce({
      items: [makeFinding("3"), makeFinding("4")],
      offset: 2,
      limit: 8,
      total: 4,
      next_offset: null,
      has_more: false,
    });
    await userEvent.click(screen.getByRole("button", { name: "Explore more angles" }));

    expect(await screen.findByText("Finding 3")).toBeInTheDocument();
    expect(screen.getByText("Finding 1")).toBeInTheDocument(); // original items preserved
    expect(screen.getAllByText(/^Finding \d$/)).toHaveLength(4); // no duplicates
    expect(getAnalysisFindingsMock).toHaveBeenCalledWith("d1", 2, 8);
    expect(screen.queryByRole("button", { name: "Explore more angles" })).not.toBeInTheDocument();
  });

  it("shows no theme picker and no cleaning UI", async () => {
    getAnalysisFindingsMock.mockResolvedValue({ items: [makeFinding("1")], offset: 0, limit: 8, total: 1, next_offset: null, has_more: false });
    renderPage();

    await screen.findByText("Finding 1");
    // The Cleaning stage-tab link legitimately appears on every dataset-scoped page; what must
    // be absent is the Cleaning Review *content* itself (operations, diff, theme picker).
    expect(screen.queryByText(/Theme/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Proposed changes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Accept all/)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a Build your own chart link to Chart Explorer with dataset context preserved", async () => {
    getAnalysisFindingsMock.mockResolvedValue({ items: [makeFinding("1")], offset: 0, limit: 8, total: 1, next_offset: null, has_more: false });
    renderPage();

    const link = await screen.findByRole("button", { name: /Explore charts/ });
    await userEvent.click(link);
    expect(routerPush).toHaveBeenCalledWith("/explorer?datasetId=d1");
  });

  it("Open in Studio navigates to the nested Studio route using the page's own projectId", async () => {
    getAnalysisFindingsMock.mockResolvedValue({ items: [makeFinding("1")], offset: 0, limit: 8, total: 1, next_offset: null, has_more: false });
    createVisualizationMock.mockResolvedValue({ id: "viz1", project_id: "p1" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open in Studio" }));
    expect(routerPush).toHaveBeenCalledWith("/projects/p1/visualizations/viz1");
  });

  it("shows the staged-processing state while analysis is still running", async () => {
    getAnalysisMock.mockResolvedValue({ status: "ai_analyzing", stages: { ai_analyzing: "processing" }, dataset_version_id: "v1", data_quality: null, error: null });
    renderPage();
    expect(await screen.findByText("Analyzing dataset…")).toBeInTheDocument();
  });

  it("shows an error state, preserving the shell, when analysis failed", async () => {
    getAnalysisMock.mockResolvedValue({ status: "failed", stages: {}, dataset_version_id: "v1", data_quality: null, error: "boom" });
    renderPage();

    expect(await screen.findByText("Analysis didn't complete.")).toBeInTheDocument();
    expect(screen.getByText(/Your dataset is unaffected/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dataset stages" })).toBeInTheDocument();
  });
});
