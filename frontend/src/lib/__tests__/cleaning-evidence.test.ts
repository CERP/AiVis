import { describe, expect, it } from "vitest";

import { computeEvidence } from "../cleaning-evidence";
import type { ValidationWorkflowResponse, WorkflowCleaningStep } from "@/lib/api/datasets";

function workflowWith(before: Record<string, unknown>[], after: Record<string, unknown>[]) {
  return {
    before: { rows: before },
    after: { rows: after },
  } as ValidationWorkflowResponse;
}

describe("computeEvidence", () => {
  it("counts and collects changed rows for the step's column only", () => {
    const step: WorkflowCleaningStep = {
      column_name: "region",
      action_type: "standardize_case",
      reason: "r",
      params: {},
    };
    const workflow = workflowWith(
      [{ region: "male", other: 1 }, { region: "North", other: 2 }],
      [{ region: "Male", other: 1 }, { region: "North", other: 2 }]
    );

    const evidence = computeEvidence(workflow, step, [step]);
    expect(evidence.changedInPreview).toBe(1);
    expect(evidence.previewSize).toBe(2);
    expect(evidence.examples).toEqual([{ before: "male", after: "Male" }]);
    expect(evidence.sharedWithOtherSteps).toBe(false);
  });

  it("caps collected examples at 5 even if more rows changed", () => {
    const step: WorkflowCleaningStep = {
      column_name: "x",
      action_type: "trim_strings",
      reason: "r",
      params: {},
    };
    const before = Array.from({ length: 10 }, (_, i) => ({ x: ` v${i} ` }));
    const after = Array.from({ length: 10 }, (_, i) => ({ x: `v${i}` }));
    const workflow = workflowWith(before, after);

    const evidence = computeEvidence(workflow, step, [step]);
    expect(evidence.changedInPreview).toBe(10);
    expect(evidence.examples).toHaveLength(5);
  });

  it("flags when another step shares the same column", () => {
    const step1: WorkflowCleaningStep = { column_name: "region", action_type: "trim_strings", reason: "r", params: {} };
    const step2: WorkflowCleaningStep = { column_name: "region", action_type: "standardize_case", reason: "r", params: {} };
    const workflow = workflowWith([{ region: "a" }], [{ region: "A" }]);

    const evidence = computeEvidence(workflow, step1, [step1, step2]);
    expect(evidence.sharedWithOtherSteps).toBe(true);
  });

  it("returns no evidence for a column-less step (e.g. dedupe_rows)", () => {
    const step: WorkflowCleaningStep = { column_name: null, action_type: "dedupe_rows", reason: "r", params: {} };
    const workflow = workflowWith([{ a: 1 }], [{ a: 1 }]);

    const evidence = computeEvidence(workflow, step, [step]);
    expect(evidence.changedInPreview).toBe(0);
    expect(evidence.examples).toEqual([]);
  });
});
