import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatasetRow } from "../dataset-row";
import type { Dataset } from "@/lib/api/datasets";

const baseDataset: Dataset = {
  id: "d1",
  project_id: "p1",
  name: "sales_q3",
  original_filename: "sales_q3.csv",
  mime_type: "text/csv",
  size_bytes: 2_500_000,
  status: "ready",
  error_message: null,
  created_at: new Date().toISOString(),
};

describe("DatasetRow", () => {
  it("renders the dataset name and status", () => {
    render(<DatasetRow dataset={baseDataset} onDelete={vi.fn()} />);

    expect(screen.getByText("sales_q3.csv")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("links to the dataset when ready", () => {
    render(<DatasetRow dataset={baseDataset} onDelete={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Open dataset sales_q3.csv/ })).toHaveAttribute(
      "href",
      "/datasets/d1"
    );
  });

  it("does not link when the dataset is still processing", () => {
    render(<DatasetRow dataset={{ ...baseDataset, status: "profiling" }} onDelete={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
  });

  it("renders safely with no quality metadata on the payload", () => {
    // Dataset from the list endpoint never carries a quality field -- this documents that the
    // row renders correctly without one rather than expecting/fetching it per row.
    render(<DatasetRow dataset={baseDataset} onDelete={vi.fn()} />);
    expect(screen.queryByText(/quality/i)).not.toBeInTheDocument();
  });

  it("surfaces the failure message for a failed dataset", () => {
    render(
      <DatasetRow
        dataset={{ ...baseDataset, status: "failed", error_message: "Malformed CSV" }}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Malformed CSV");
  });
});
