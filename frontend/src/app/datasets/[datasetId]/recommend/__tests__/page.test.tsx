import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ datasetId: "d1" }),
  useRouter: () => ({ replace: routerReplace }),
}));

const getDatasetMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  getDataset: (...args: unknown[]) => getDatasetMock(...args),
}));

const getAnalysisMock = vi.fn();
vi.mock("@/lib/api/analysis", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
}));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

import LegacyRecommendRedirectPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegacyRecommendRedirectPage />
    </QueryClientProvider>
  );
}

describe("Legacy /recommend redirect", () => {
  beforeEach(() => {
    routerReplace.mockClear();
    getDatasetMock.mockReset();
    getAnalysisMock.mockReset();
  });

  it("redirects to Cleaning when the dataset still has quality issues", async () => {
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1" });
    getAnalysisMock.mockResolvedValue({ data_quality: { score: 62, issues: [{ type: "x" }] } });

    renderPage();

    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/projects/p1/datasets/d1/cleaning")
    );
  });

  it("redirects to Analysis when the dataset has no quality issues", async () => {
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1" });
    getAnalysisMock.mockResolvedValue({ data_quality: { score: 94, issues: [] } });

    renderPage();

    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/projects/p1/datasets/d1/analysis")
    );
  });

  it("shows a loading state while resolving, and does not call any new AI-triggering endpoint", () => {
    getDatasetMock.mockReturnValue(new Promise(() => {}));
    getAnalysisMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading dataset…")).toBeInTheDocument();
  });

  it("shows an error state if the dataset can't be resolved", async () => {
    getDatasetMock.mockRejectedValue(new Error("not found"));
    getAnalysisMock.mockResolvedValue({ data_quality: null });
    renderPage();
    await waitFor(() => expect(screen.getByText("Couldn't load this dataset.")).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
