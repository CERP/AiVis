import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

const listDatasetsMock = vi.fn();
vi.mock("@/lib/api/datasets", () => ({
  listDatasets: (...args: unknown[]) => listDatasetsMock(...args),
}));

import { DatasetPicker } from "../dataset-picker";

function renderPicker(onSelect = vi.fn(), onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onSelect,
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DatasetPicker onSelect={onSelect} onClose={onClose} />
      </QueryClientProvider>
    ),
  };
}

describe("DatasetPicker", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    listDatasetsMock.mockReset();
  });

  it("shows the project list first", async () => {
    apiGetMock.mockResolvedValue([{ id: "p1", name: "Acme Q3 Sales" }]);
    renderPicker();
    expect(await screen.findByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(listDatasetsMock).not.toHaveBeenCalled();
  });

  it("fetches only the chosen project's datasets, not every project's", async () => {
    apiGetMock.mockResolvedValue([
      { id: "p1", name: "Acme Q3 Sales" },
      { id: "p2", name: "Other Project" },
    ]);
    listDatasetsMock.mockResolvedValue([
      { id: "d1", project_id: "p1", original_filename: "sales_q3.csv", status: "ready" },
    ]);
    renderPicker();

    await userEvent.click(await screen.findByText("Acme Q3 Sales"));
    expect(await screen.findByText("sales_q3.csv")).toBeInTheDocument();
    expect(listDatasetsMock).toHaveBeenCalledTimes(1);
    expect(listDatasetsMock).toHaveBeenCalledWith("p1");
  });

  it("only lists ready datasets", async () => {
    apiGetMock.mockResolvedValue([{ id: "p1", name: "Acme Q3 Sales" }]);
    listDatasetsMock.mockResolvedValue([
      { id: "d1", project_id: "p1", original_filename: "ready.csv", status: "ready" },
      { id: "d2", project_id: "p1", original_filename: "processing.csv", status: "profiling" },
    ]);
    renderPicker();

    await userEvent.click(await screen.findByText("Acme Q3 Sales"));
    expect(await screen.findByText("ready.csv")).toBeInTheDocument();
    expect(screen.queryByText("processing.csv")).not.toBeInTheDocument();
  });

  it("calls onSelect with the chosen dataset", async () => {
    apiGetMock.mockResolvedValue([{ id: "p1", name: "Acme Q3 Sales" }]);
    const dataset = { id: "d1", project_id: "p1", original_filename: "sales_q3.csv", status: "ready" };
    listDatasetsMock.mockResolvedValue([dataset]);
    const { onSelect } = renderPicker();

    await userEvent.click(await screen.findByText("Acme Q3 Sales"));
    await userEvent.click(await screen.findByText("sales_q3.csv"));
    expect(onSelect).toHaveBeenCalledWith(dataset);
  });
});
