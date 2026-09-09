import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/visualization/visualization-renderer", () => ({
  VisualizationRenderer: () => <div data-testid="chart-render">chart</div>,
}));

const routerPush = vi.fn();
let searchParamsValue = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

const getDatasetMock = vi.fn();
const listDatasetsMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
  listDatasets: (...args: unknown[]) => listDatasetsMock(...args),
}));

const getProfileMock = vi.fn();
vi.mock("@/lib/api/insights", () => ({
  getProfile: (...args: unknown[]) => getProfileMock(...args),
}));

const createVisualizationMock = vi.fn();
vi.mock("@/lib/api/visualizations", () => ({
  createVisualization: (...args: unknown[]) => createVisualizationMock(...args),
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => apiGetMock(...args) },
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

import ChartExplorerPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChartExplorerPage />
    </QueryClientProvider>
  );
}

const profile = {
  dataset_version_id: "v1",
  row_count: 10,
  column_count: 2,
  columns: [
    { id: "c1", name: "region", ordinal: 0, raw_type: "string", semantic_type: "categorical", is_pii: false, null_count: 0, unique_count: 4, stats: {} },
    { id: "c2", name: "revenue", ordinal: 1, raw_type: "float", semantic_type: "numeric", is_pii: false, null_count: 0, unique_count: 10, stats: {} },
  ],
};

describe("ChartExplorerPage", () => {
  beforeEach(() => {
    searchParamsValue = "";
    routerPush.mockClear();
    getDatasetMock.mockReset();
    listDatasetsMock.mockReset().mockResolvedValue([]);
    getProfileMock.mockReset().mockResolvedValue(profile);
    createVisualizationMock.mockReset();
    apiGetMock.mockReset().mockResolvedValue([]);
  });

  it("shows a default category's charts on load (global entry, no dataset context)", () => {
    renderPage();
    expect(screen.getByText("Column Chart")).toBeInTheDocument();
    expect(screen.queryByText(/For /)).not.toBeInTheDocument();
  });

  it("filters to one category at a time", async () => {
    renderPage();
    expect(screen.getByText("Column Chart")).toBeInTheDocument(); // comparison, default category
    await userEvent.click(screen.getByRole("button", { name: /Temporal/ }));
    expect(screen.queryByText("Column Chart")).not.toBeInTheDocument();
    expect(screen.getByText("Line Chart")).toBeInTheDocument();
  });

  it("search supersedes category filtering across all categories", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Search charts"), "candlestick");
    expect(screen.getByText("Candlestick Chart")).toBeInTheDocument();
    expect(screen.queryByText("Column Chart")).not.toBeInTheDocument();
  });

  it("shows an empty state with clear-search for no matches", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Search charts"), "zzz-no-match");
    expect(screen.getByText(/No charts match "zzz-no-match"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Column Chart")).toBeInTheDocument();
  });

  it("global entry: clicking Use this chart opens the dataset picker, not an immediate create", async () => {
    apiGetMock.mockResolvedValue([{ id: "p1", name: "Acme Q3 Sales" }]);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /^Column Chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Use this chart" }));

    expect(await screen.findByRole("dialog", { name: "Choose a dataset" })).toBeInTheDocument();
    expect(createVisualizationMock).not.toHaveBeenCalled();
  });

  it("global entry: selecting a dataset in the picker creates the visualization and opens Studio", async () => {
    apiGetMock.mockResolvedValue([{ id: "p1", name: "Acme Q3 Sales" }]);
    listDatasetsMock.mockResolvedValue([
      { id: "d1", project_id: "p1", original_filename: "sales_q3.csv", status: "ready" },
    ]);
    createVisualizationMock.mockResolvedValue({ id: "viz1", project_id: "p1" });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /^Column Chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Use this chart" }));
    await userEvent.click(await screen.findByText("Acme Q3 Sales"));
    await userEvent.click(await screen.findByText("sales_q3.csv"));

    await waitFor(() => expect(createVisualizationMock).toHaveBeenCalled());
    expect(routerPush).toHaveBeenCalledWith("/projects/p1/visualizations/viz1");
  });

  it("contextual entry: resolves the dataset and shows a context indicator, no picker needed", async () => {
    searchParamsValue = "datasetId=d1";
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    renderPage();

    expect(await screen.findByText("For sales_q3.csv")).toBeInTheDocument();
  });

  it("contextual entry: Use this chart creates directly, without opening a picker", async () => {
    searchParamsValue = "datasetId=d1";
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    createVisualizationMock.mockResolvedValue({ id: "viz1", project_id: "p1" });
    renderPage();

    await screen.findByText("For sales_q3.csv");
    await userEvent.click(screen.getByRole("button", { name: /^Column Chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Use this chart" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/projects/p1/visualizations/viz1"));
  });

  it("invalid datasetId: shows an inline error and still allows global browsing", async () => {
    searchParamsValue = "datasetId=bad-id";
    getDatasetMock.mockRejectedValue(new Error("not found"));
    renderPage();

    expect(await screen.findByText(/Couldn't load this dataset context/)).toBeInTheDocument();
    expect(screen.getByText("Column Chart")).toBeInTheDocument();
  });

  it("shows an inline error, not a crash, when the dataset can't support the chosen chart", async () => {
    searchParamsValue = "datasetId=d1";
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue({ ...profile, columns: [profile.columns[0]] }); // only 1 column
    renderPage();

    await screen.findByText("For sales_q3.csv");
    await userEvent.click(screen.getByRole("button", { name: /^Column Chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Use this chart" }));

    expect(await screen.findByText(/isn't compatible with the columns/)).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
