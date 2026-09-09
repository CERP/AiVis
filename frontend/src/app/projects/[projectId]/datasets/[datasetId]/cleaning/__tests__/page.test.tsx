import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const getValidationWorkflowMock = vi.fn();
const applyValidationWorkflowMock = vi.fn();
const downloadDatasetMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
  getValidationWorkflow: (...args: unknown[]) => getValidationWorkflowMock(...args),
  applyValidationWorkflow: (...args: unknown[]) => applyValidationWorkflowMock(...args),
  downloadDataset: (...args: unknown[]) => downloadDatasetMock(...args),
}));

import CleaningReviewPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CleaningReviewPage />
    </QueryClientProvider>
  );
}

const baseWorkflow = {
  audit_id: "a1",
  source_version_id: "v0",
  cleaned_version_id: null,
  workflow_status: "ready",
  dataset_status: "requires_cleaning",
  data_quality_score_before: 62,
  data_quality_score_after: 94,
  columns: ["region"],
  before: { rows: [{ region: "male" }, { region: "North" }] },
  after: { rows: [{ region: "Male" }, { region: "North" }] },
  anomalies: [],
  remaining_issues: [{ column_name: "revenue", row_index: 4, value: -5, issue_type: "outlier", description: "Negative revenue" }],
  cleaning_recipe: [
    { column_name: "region", action_type: "standardize_case", reason: "Casing differs only.", params: { case: "title" } },
  ],
  cleaning_summary: ["Normalized region casing."],
  changed_cells: 1,
  changed_rows: 1,
  removed_rows: 0,
  validation_errors: [],
};

describe("CleaningReviewPage", () => {
  beforeEach(() => {
    projectGetMock.mockReset().mockResolvedValue({ id: "p1", name: "Acme Q3 Sales" });
    getDatasetMock.mockReset().mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });
    getValidationWorkflowMock.mockReset();
    applyValidationWorkflowMock.mockReset();
    downloadDatasetMock.mockReset();
    routerPush.mockClear();
  });

  it("renders the breadcrumb and active Cleaning stage tab", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    renderPage();

    expect(await screen.findByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(screen.getByText("sales_q3.csv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cleaning" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the healthy state with no operation list when there is nothing to clean", async () => {
    getValidationWorkflowMock.mockResolvedValue({
      ...baseWorkflow,
      dataset_status: "healthy",
      cleaning_recipe: [],
    });
    renderPage();

    expect(await screen.findByText("No cleaning needed. This dataset is healthy.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows the unsuitable state with safe supported actions only", async () => {
    getValidationWorkflowMock.mockResolvedValue({
      ...baseWorkflow,
      dataset_status: "unsuitable",
    });
    renderPage();

    expect(await screen.findByText(/isn't suitable for automatic cleaning/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use original anyway" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download original" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply selected" })).not.toBeInTheDocument();
  });

  it("renders the flagged-but-not-changed section separately from operations", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    renderPage();

    expect(await screen.findByText("Flagged, not changed (1)")).toBeInTheDocument();
    expect(screen.getByText(/Negative revenue/)).toBeInTheDocument();
  });

  it("defaults every operation to selected (Accept all is the implicit default)", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    renderPage();

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(screen.getByText("1 of 1 operations selected")).toBeInTheDocument();
  });

  it("Accept all applies with no selected_step_indices (full recipe, cached path)", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    applyValidationWorkflowMock.mockResolvedValue({ dataset_version_id: "v2", version_number: 2, selection: "cleaned", cleaned_version_created: true, analysis_status: "queued" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Accept all" }));
    expect(applyValidationWorkflowMock).toHaveBeenCalledWith("d1", "a1", "cleaned", undefined);
  });

  it("Reject all applies with selection=original", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    applyValidationWorkflowMock.mockResolvedValue({ dataset_version_id: "v0", version_number: 1, selection: "original", cleaned_version_created: false, analysis_status: "queued" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Reject all" }));
    expect(applyValidationWorkflowMock).toHaveBeenCalledWith("d1", "a1", "original", undefined);
  });

  it("Apply selected sends only the checked step indices", async () => {
    const twoStepWorkflow = {
      ...baseWorkflow,
      cleaning_recipe: [
        { column_name: "region", action_type: "trim_strings", reason: "r1", params: {} },
        { column_name: "revenue", action_type: "fill_missing", reason: "r2", params: { method: "median" } },
      ],
    };
    getValidationWorkflowMock.mockResolvedValue(twoStepWorkflow);
    applyValidationWorkflowMock.mockResolvedValue({ dataset_version_id: "v2", version_number: 2, selection: "cleaned", cleaned_version_created: true, analysis_status: "queued" });
    renderPage();

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    await userEvent.click(checkboxes[1]); // uncheck the second operation

    expect(screen.getByText("1 of 2 operations selected")).toBeInTheDocument();
    expect(screen.getByText(/Potential score with all suggested changes applied/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Apply selected" }));
    expect(applyValidationWorkflowMock).toHaveBeenCalledWith("d1", "a1", "cleaned", [0]);
  });

  it("preserves the current selection and shows an inline error when Apply fails", async () => {
    getValidationWorkflowMock.mockResolvedValue(baseWorkflow);
    applyValidationWorkflowMock.mockRejectedValue(new Error("boom"));
    renderPage();

    const checkbox = await screen.findByRole("checkbox");
    await userEvent.click(screen.getByRole("button", { name: "Apply selected" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(checkbox).toBeChecked(); // selection untouched by the failed request
  });
});
