import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "p1" }),
}));

const projectGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => projectGetMock(...args) },
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

const listDatasetsMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  listDatasets: (...args: unknown[]) => listDatasetsMock(...args),
  uploadDatasetWithProgress: vi.fn(),
  deleteDataset: vi.fn(),
}));

const listVisualizationsMock = vi.fn();
vi.mock("@/lib/api/visualizations", () => ({
  listVisualizations: (...args: unknown[]) => listVisualizationsMock(...args),
}));

import ProjectDetailPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectDetailPage />
    </QueryClientProvider>
  );
}

describe("ProjectDetailPage", () => {
  it("renders the datasets section", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    listDatasetsMock.mockResolvedValue([
      {
        id: "d1",
        project_id: "p1",
        name: "sales_q3",
        original_filename: "sales_q3.csv",
        mime_type: "text/csv",
        size_bytes: 1_000_000,
        status: "ready",
        error_message: null,
        created_at: new Date().toISOString(),
      },
    ]);
    listVisualizationsMock.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("sales_q3.csv")).toBeInTheDocument();
    expect(screen.getByText("Datasets")).toBeInTheDocument();
  });

  it("renders the visualizations section with its empty-state sentence", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    listDatasetsMock.mockResolvedValue([]);
    listVisualizationsMock.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText("Visualizations will appear here once you analyze a dataset.")
    ).toBeInTheDocument();
  });

  it("isolates a visualizations-section failure from a healthy datasets section", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    listDatasetsMock.mockResolvedValue([
      {
        id: "d1",
        project_id: "p1",
        name: "sales_q3",
        original_filename: "sales_q3.csv",
        mime_type: "text/csv",
        size_bytes: 1_000_000,
        status: "ready",
        error_message: null,
        created_at: new Date().toISOString(),
      },
    ]);
    listVisualizationsMock.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByText("sales_q3.csv")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Couldn't load visualizations.")).toBeInTheDocument()
    );
  });

  it("isolates a datasets-section failure from a healthy visualizations section", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    listDatasetsMock.mockRejectedValue(new Error("boom"));
    listVisualizationsMock.mockResolvedValue([
      {
        id: "v1",
        title: "Revenue by region",
        chart_type: "bar",
        dataset_id: "d1",
        dataset_name: "sales_q3.csv",
        updated_at: new Date().toISOString(),
      },
    ]);

    renderPage();

    expect(await screen.findByText("Revenue by region")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Couldn't load datasets.")).toBeInTheDocument());
  });
});
