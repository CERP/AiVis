import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ visualizationId: "viz1" }),
  useRouter: () => ({ replace: routerReplace }),
}));

const getVisualizationMock = vi.fn();
vi.mock("@/lib/api/visualizations", () => ({
  getVisualization: (...args: unknown[]) => getVisualizationMock(...args),
}));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    detail = "";
  },
}));

import LegacyStudioRedirectPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegacyStudioRedirectPage />
    </QueryClientProvider>
  );
}

describe("Legacy /studio/[id] redirect", () => {
  beforeEach(() => {
    routerReplace.mockClear();
    getVisualizationMock.mockReset();
  });

  it("redirects to the nested Studio route, preserving the visualization identity", async () => {
    getVisualizationMock.mockResolvedValue({ id: "viz1", project_id: "p1" });
    renderPage();
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/projects/p1/visualizations/viz1")
    );
  });

  it("uses no extra fetch beyond the visualization lookup itself to build the redirect URL", async () => {
    getVisualizationMock.mockResolvedValue({ id: "viz1", project_id: "p1" });
    renderPage();
    await waitFor(() => expect(routerReplace).toHaveBeenCalled());
    expect(getVisualizationMock).toHaveBeenCalledTimes(1);
  });

  it("shows an error state if the visualization can't be resolved", async () => {
    getVisualizationMock.mockRejectedValue(new Error("not found"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Couldn't load this visualization/)).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
