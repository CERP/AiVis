import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const getMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args), post: vi.fn() },
}));

import ProjectsPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsPage />
    </QueryClientProvider>
  );
}

describe("ProjectsPage", () => {
  it("shows the create-project action", async () => {
    getMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("button", { name: /New project/ })).toBeInTheDocument();
  });

  it("renders a row per project", async () => {
    getMock.mockResolvedValue([
      { id: "p1", name: "Acme Q3 Sales", dataset_count: 2, updated_at: new Date().toISOString() },
      { id: "p2", name: "Retail Cohort", dataset_count: 0, updated_at: new Date().toISOString() },
    ]);
    renderPage();

    expect(await screen.findByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(screen.getByText("Retail Cohort")).toBeInTheDocument();
  });

  it("shows the empty state with no projects", async () => {
    getMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });

  it("shows a retry-able error state on fetch failure", async () => {
    getMock.mockRejectedValue(new Error("network down"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Couldn't load your projects.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
