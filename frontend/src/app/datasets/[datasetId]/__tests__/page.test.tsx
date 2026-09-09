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

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

import LegacyDatasetRedirectPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegacyDatasetRedirectPage />
    </QueryClientProvider>
  );
}

describe("Legacy /datasets/[datasetId] redirect", () => {
  beforeEach(() => {
    routerReplace.mockClear();
    getDatasetMock.mockReset();
  });

  it("resolves the dataset's project and redirects to the nested route", async () => {
    getDatasetMock.mockResolvedValue({ id: "d1", project_id: "p1", original_filename: "sales_q3.csv" });

    renderPage();

    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/projects/p1/datasets/d1")
    );
  });

  it("shows a loading state while resolving", () => {
    getDatasetMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading dataset…")).toBeInTheDocument();
  });

  it("shows an error state if the dataset can't be resolved", async () => {
    getDatasetMock.mockRejectedValue(new Error("not found"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Couldn't find that dataset.")).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
