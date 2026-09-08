import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatasetDiffGrid } from "../dataset-diff-grid";
import type { ValidationWorkflowResponse } from "@/lib/api/datasets";

vi.mock("@/lib/api/datasets", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/datasets")>();
  return { ...original, downloadDataset: vi.fn() };
});

const workflow: ValidationWorkflowResponse = {
  audit_id: "audit-1",
  source_version_id: "version-0",
  cleaned_version_id: null,
  workflow_status: "ready",
  dataset_status: "requires_cleaning",
  data_quality_score_before: 65,
  data_quality_score_after: 91,
  columns: ["student", "score"],
  before: { rows: [{ student: " A ", score: 80 }] },
  after: { rows: [{ student: "A", score: 80 }] },
  anomalies: [{
    column_name: "student",
    row_index: 0,
    value: " A ",
    issue_type: "whitespace",
    description: "Whitespace around student name",
  }],
  remaining_issues: [],
  cleaning_recipe: [{
    column_name: "student",
    action_type: "trim_strings",
    reason: "Normalize names",
    params: {},
  }],
  cleaning_summary: ["Trimmed student names."],
  changed_cells: 1,
  changed_rows: 1,
  removed_rows: 0,
  validation_errors: [],
};

describe("DatasetDiffGrid", () => {
  it("confirms original and cleaned version choices with distinct warnings", () => {
    const onConfirm = vi.fn();
    render(<DatasetDiffGrid datasetId="dataset-1" workflow={workflow} onConfirm={onConfirm} />);

    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("Gemini-cleaned")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Make Graphs" })[0]);
    expect(screen.getByText(/original dataset, which contains identified/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledWith("raw");

    fireEvent.click(screen.getAllByRole("button", { name: "Make Graphs" })[1]);
    expect(screen.getByText(/Gemini's cleaned dataset/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledWith("cleaned");
  });

  it("blocks a cleaned selection rejected by integrity validation", () => {
    render(
      <DatasetDiffGrid
        datasetId="dataset-1"
        workflow={{ ...workflow, workflow_status: "validation_failed", validation_errors: ["data loss"] }}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("data loss");
    expect(screen.getAllByRole("button", { name: "Make Graphs" })[1]).toBeDisabled();
  });
});

describe("whitespace-only differences", () => {
  const withName = (before: unknown, after: unknown): ValidationWorkflowResponse => ({
    ...workflow,
    columns: ["student"],
    before: { rows: [{ student: before }] },
    after: { rows: [{ student: after }] },
    anomalies: [],
  });

  it("renders padding as middots so a trim step shows its evidence", () => {
    // Without this the two panels paint identically and the change highlight looks arbitrary.
    render(<DatasetDiffGrid datasetId="d" workflow={withName("  Hira Shah  ", "Hira Shah")} onConfirm={vi.fn()} />);
    expect(screen.getAllByTitle("2 whitespace characters")).toHaveLength(2);
  });

  it("leaves values without padding unmarked", () => {
    render(<DatasetDiffGrid datasetId="d" workflow={withName("Ahmed Khan", "Ahmed Khan")} onConfirm={vi.fn()} />);
    expect(screen.queryByTitle(/whitespace character/)).toBeNull();
  });

  it("counts an all-whitespace value once rather than at both ends", () => {
    render(<DatasetDiffGrid datasetId="d" workflow={withName("   ", "")} onConfirm={vi.fn()} />);
    const marks = screen.getAllByTitle("3 whitespace characters");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("···");
  });

  it("still renders nulls as null", () => {
    render(<DatasetDiffGrid datasetId="d" workflow={withName(null, null)} onConfirm={vi.fn()} />);
    expect(screen.getAllByText("null")).toHaveLength(2);
  });
});
