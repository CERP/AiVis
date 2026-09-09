import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OperationRow } from "../operation-row";
import type { WorkflowCleaningStep } from "@/lib/api/datasets";

const step: WorkflowCleaningStep = {
  column_name: "region",
  action_type: "standardize_case",
  reason: "Values differ only by casing and represent the same category.",
  params: { case: "title" },
};

const evidence = {
  examples: [
    { before: "male", after: "Male" },
    { before: "M", after: "Male" },
  ],
  changedInPreview: 2,
  previewSize: 20,
  sharedWithOtherSteps: false,
};

describe("OperationRow", () => {
  it("shows collapsed content: title, affected count, and column", () => {
    render(<OperationRow step={step} selected onToggle={vi.fn()} evidence={evidence} />);
    expect(screen.getByText("Normalize casing in region")).toBeInTheDocument();
    expect(screen.getByText(/2 of 20 previewed rows affected · region/)).toBeInTheDocument();
  });

  it("does not show evidence or rationale until expanded", () => {
    render(<OperationRow step={step} selected onToggle={vi.fn()} evidence={evidence} />);
    expect(screen.queryByText("Why this change?")).not.toBeInTheDocument();
  });

  it("reveals rationale and evidence on expand", async () => {
    render(<OperationRow step={step} selected onToggle={vi.fn()} evidence={evidence} />);
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Why this change?")).toBeInTheDocument();
    expect(screen.getByText(step.reason)).toBeInTheDocument();
    expect(screen.getByText("Method")).toBeInTheDocument();
    expect(screen.getByText(/male/)).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    render(<OperationRow step={step} selected onToggle={vi.fn()} evidence={evidence} />);
    const toggle = screen.getByRole("button");
    await userEvent.click(toggle);
    expect(screen.getByText("Why this change?")).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.queryByText("Why this change?")).not.toBeInTheDocument();
  });

  it("fires onToggle when the checkbox is clicked, independent of expand state", async () => {
    const onToggle = vi.fn();
    render(<OperationRow step={step} selected onToggle={onToggle} evidence={evidence} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("reflects the excluded (unchecked) state", () => {
    render(<OperationRow step={step} selected={false} onToggle={vi.fn()} evidence={evidence} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("never shows a confidence percentage", () => {
    render(<OperationRow step={step} selected onToggle={vi.fn()} evidence={evidence} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
