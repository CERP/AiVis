import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
}));

const getProfileMock = vi.fn();
vi.mock("@/lib/api/insights", () => ({
  getProfile: (...args: unknown[]) => getProfileMock(...args),
}));

const getAnalysisMock = vi.fn();
vi.mock("@/lib/api/analysis", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
  ANALYSIS_STAGE_LABELS: { ai_analyzing: "AI is analyzing" },
}));

import DatasetOverviewPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DatasetOverviewPage />
    </QueryClientProvider>
  );
}

const baseProfile = {
  dataset_version_id: "v1",
  row_count: 12400,
  column_count: 2,
  columns: [
    {
      id: "c1",
      name: "region",
      ordinal: 0,
      raw_type: "string",
      semantic_type: "categorical",
      is_pii: false,
      null_count: 0,
      unique_count: 6,
      stats: {},
    },
    {
      id: "c2",
      name: "email",
      ordinal: 1,
      raw_type: "string",
      semantic_type: "text",
      is_pii: true,
      null_count: 0,
      unique_count: 100,
      stats: {},
    },
  ],
};

describe("DatasetOverviewPage", () => {
  it("renders the breadcrumb with project and dataset name", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue(baseProfile);
    getAnalysisMock.mockResolvedValue({ status: "ready", stages: {}, data_quality: { score: 94, issues: [] } });

    renderPage();

    expect(await screen.findByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(screen.getByText("sales_q3.csv")).toBeInTheDocument();
  });

  it("shows 'Continue to Analysis' for a healthy dataset", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue(baseProfile);
    getAnalysisMock.mockResolvedValue({ status: "ready", stages: {}, data_quality: { score: 94, issues: [] } });

    renderPage();

    const button = await screen.findByRole("button", { name: /Continue to Analysis/ });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/94 — Healthy/)).toBeInTheDocument();
  });

  it("shows 'Review Cleaning' for a dataset with quality issues", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue(baseProfile);
    getAnalysisMock.mockResolvedValue({
      status: "ready",
      stages: {},
      data_quality: {
        score: 62,
        issues: [{ type: "missing_values", column: "region", description: "12 missing values", severity: "medium" }],
      },
    });

    renderPage();

    const button = await screen.findByRole("button", { name: /Review Cleaning/ });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/62 — Needs cleaning/)).toBeInTheDocument();
  });

  it("routes the healthy-state CTA to the still-transitional /recommend flow (Analysis isn't built yet)", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue(baseProfile);
    getAnalysisMock.mockResolvedValue({ status: "ready", stages: {}, data_quality: { score: 94, issues: [] } });

    renderPage();
    const button = await screen.findByRole("button", { name: /Continue to Analysis/ });
    button.click();
    expect(routerPush).toHaveBeenCalledWith("/datasets/d1/recommend");
  });

  it("routes the messy-state CTA to the real nested Cleaning route", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockResolvedValue(baseProfile);
    getAnalysisMock.mockResolvedValue({
      status: "ready",
      stages: {},
      data_quality: {
        score: 62,
        issues: [{ type: "missing_values", column: "region", description: "12 missing values", severity: "medium" }],
      },
    });

    renderPage();
    const button = await screen.findByRole("button", { name: /Review Cleaning/ });
    button.click();
    expect(routerPush).toHaveBeenCalledWith("/projects/p1/datasets/d1/cleaning");
  });

  it("shows the loading state while the profile is fetching", () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockReturnValue(new Promise(() => {}));
    getAnalysisMock.mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByText("Loading profile…")).toBeInTheDocument();
  });

  it("shows an error state, preserving the page shell, if profiling fails", async () => {
    projectGetMock.mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getProfileMock.mockRejectedValue(new Error("boom"));
    getAnalysisMock.mockResolvedValue({ status: "ready", stages: {}, data_quality: null });

    renderPage();

    await waitFor(() => expect(screen.getByText("Profiling failed")).toBeInTheDocument());
    expect(screen.getByRole("navigation", { name: "Dataset stages" })).toBeInTheDocument();
  });
});
